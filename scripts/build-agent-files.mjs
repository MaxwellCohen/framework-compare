#!/usr/bin/env node
/**
 * src/data/generated/*.json → the files agents and crawlers read, written to
 * public/ so `pracht build` copies them into the static export:
 *
 *   /llms.txt, /llms-full.txt        llmstxt.org index and the full text
 *   /api/*.json                      the data as stable JSON (see /api/index.json)
 *   /index.md, /frameworks/<id>.md…  a markdown twin of each page
 *   /sitemap.xml                     every HTML route
 *
 * Runs before `pracht build` and `pracht dev` (see package.json). The outputs
 * are gitignored. public/robots.txt is hand-written and committed.
 *
 * The repo-root llms.txt is Pracht's authoring guide for coding agents and is
 * unrelated to the /llms.txt written here.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(PROJECT, "public");
const read = (p) => JSON.parse(readFileSync(join(PROJECT, p), "utf8"));

const site = read("src/data/site.json");
const capability = read("src/data/generated/capability.json");
const measured = read("src/data/generated/measured.json");
const benchmark = read("src/data/generated/benchmark.json");
const story = read("content/fcp-story.json");

const ORIGIN = (process.env.SITE_URL || site.url).replace(/\/+$/, "");
const abs = (path) => ORIGIN + path;

const { frameworks, features, cells, methodology } = capability;
const LABELS = site.labels;
const LABEL_ORDER = ["first-party", "experimental", "third-party", "manual"];
const GROUPS = { fcp: "First-paint levers", other: "Other features" };
const MAX = {
  fcp: 2 * features.filter((f) => f.group === "fcp").length,
  other: 2 * features.filter((f) => f.group === "other").length,
};
MAX.total = MAX.fcp + MAX.other;

const fwById = new Map(frameworks.map((f) => [f.id, f]));
const cellOf = (fwId, featId) => cells.find((c) => c.frameworkId === fwId && c.featureId === featId);
const ranked = [...frameworks].sort((a, b) => a.rank - b.rank || a.order - b.order);
const tallyOf = (list) => Object.fromEntries(LABEL_ORDER.map((l) => [l, list.filter((c) => c.label === l).length]));
const tallyText = (t) => LABEL_ORDER.map((l) => `${t[l]} ${LABELS[l].text}`).join(", ");

// ---------------------------------------------------------------------------
// HTML → markdown. The `*Html` fields are pre-rendered from markdown with a
// small tag set (p, a, code, pre, ul/ol/li, em, strong, table, h3, div, span),
// so a small converter is enough. It throws on a tag it does not know.
// ---------------------------------------------------------------------------

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

function parse(html) {
  const root = { tag: "root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([a-z][a-z0-9]*)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*>|([^<]+)/g;
  let m;
  let last = 0;
  while ((m = re.exec(html))) {
    if (m.index !== last) throw new Error(`Unparsed HTML near: ${html.slice(last, last + 60)}`);
    last = re.lastIndex;
    const top = stack.at(-1);
    if (m[4] !== undefined) top.children.push(decode(m[4]));
    else if (m[1]) {
      if (top.tag !== m[2]) throw new Error(`Unbalanced </${m[2]}> inside <${top.tag}>`);
      stack.pop();
    } else {
      const attrs = {};
      for (const a of m[3].matchAll(/([a-z-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = decode(a[2] ?? "");
      const node = { tag: m[2], attrs, children: [] };
      top.children.push(node);
      stack.push(node);
    }
  }
  if (last !== html.length || stack.length !== 1) throw new Error(`Unbalanced HTML: ${html.slice(0, 80)}`);
  return root;
}

const textOf = (n) => (typeof n === "string" ? n : n.children.map(textOf).join(""));
const link = (href) => (href.startsWith("/") ? abs(href) : href);

function inline(n) {
  if (typeof n === "string") return n.replace(/\s+/g, " ");
  const kids = () => n.children.map(inline).join("");
  switch (n.tag) {
    case "code": {
      const t = textOf(n);
      const fence = t.includes("`") ? "``" : "`";
      return fence === "``" ? `\`\` ${t} \`\`` : `\`${t}\``;
    }
    case "a":
      return `[${kids()}](${link(n.attrs.href)})`;
    case "strong":
      return `**${kids()}**`;
    case "em":
      return `*${kids()}*`;
    case "span":
      return kids();
    default:
      throw new Error(`Unexpected inline <${n.tag}>`);
  }
}

const BLOCK = new Set(["p", "pre", "ul", "ol", "table", "div", "h3"]);

function list(n, ordered) {
  const items = n.children.filter((c) => typeof c !== "string");
  return items
    .map((li, i) => {
      const marker = ordered ? `${i + 1}. ` : "- ";
      const body = blocks(li).join("\n\n");
      return marker + body.replace(/\n/g, `\n${" ".repeat(marker.length)}`);
    })
    .join("\n");
}

function table(n) {
  const rows = [];
  const walk = (x) => {
    if (typeof x === "string") return;
    if (x.tag === "tr")
      rows.push(x.children.filter((c) => typeof c !== "string").map((c) => c.children.map(inline).join("").trim().replace(/\|/g, "\\|")));
    else x.children.forEach(walk);
  };
  walk(n);
  const [head, ...body] = rows;
  return [head, head.map(() => "---"), ...body].map((r) => `| ${r.join(" | ")} |`).join("\n");
}

/** Markdown blocks for a node's children. Loose inline runs become paragraphs. */
function blocks(n) {
  const out = [];
  let run = "";
  const flush = () => {
    if (run.trim()) out.push(run.trim());
    run = "";
  };
  for (const c of n.children) {
    if (typeof c === "string" || !BLOCK.has(c.tag)) {
      run += inline(c);
      continue;
    }
    flush();
    if (c.tag === "p") out.push(c.children.map(inline).join("").trim());
    else if (c.tag === "pre") out.push(`\`\`\`${c.attrs["data-lang"] ?? ""}\n${textOf(c).replace(/\n+$/, "")}\n\`\`\``);
    else if (c.tag === "ul" || c.tag === "ol") out.push(list(c, c.tag === "ol"));
    else if (c.tag === "table") out.push(table(c));
    else if (c.tag === "h3") out.push(`### ${c.children.map(inline).join("").trim()}`);
    else if (c.tag === "div") out.push(...blocks(c));
  }
  flush();
  return out;
}

/** `shift` demotes headings, so a fragment's `###` can sit under a deeper section. */
function md(html, shift = 0) {
  if (!html) return "";
  const text = blocks(parse(html)).join("\n\n");
  return shift ? text.replace(/^(#{1,5}) /gm, (_, h) => `${"#".repeat(Math.min(6, h.length + shift))} `) : text;
}

/** First paragraph as one line of markdown. */
const firstPara = (html) => md(html).split("\n\n")[0].replace(/\n/g, " ");

/** External links in a fragment: the vendor docs or source a claim cites. */
function sources(...fragments) {
  const seen = new Map();
  const walk = (n) => {
    if (typeof n === "string") return;
    if (n.tag === "a" && /^https?:\/\//.test(n.attrs.href) && !seen.has(n.attrs.href))
      seen.set(n.attrs.href, textOf(n).replace(/\s+/g, " ").trim());
    n.children.forEach(walk);
  };
  for (const f of fragments) if (f) walk(parse(f));
  return [...seen].map(([url, text]) => ({ url, text }));
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** Plain text that names an HTML tag, made safe for markdown: `<style>` becomes code. */
const plain = (text) => text.replace(/<[^<>\s][^<>]*>/g, (tag) => `\`${tag}\``);
/** The FCP summary and band table, as on /measured. */
const fcpSummary = () =>
  [
    `FCP values bunch into ${measured.bands.length} groups with gaps between them. Each group matches how many requests have to finish one after another before the page can paint. Take one request out of that chain and the app drops a whole band.`,
    bandsTable(),
  ].join("\n\n");

const row = (cols) => `| ${cols.join(" | ")} |`;
const tableMd = (head, rows) => [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
const fwUrl = (id) => abs(`/frameworks/${id}`);
const featUrl = (id) => abs(`/features/${id}`);
const cellUrl = (c) => abs(`/features/${c.featureId}#${c.frameworkId}`);
const labelText = (l) => `${LABELS[l].text} (${LABELS[l].points})`;
const n = (v, digits = 0) => (v == null ? "n/a" : digits ? v.toFixed(digits) : String(Math.round(v)));
const seconds = (ms) => (ms == null ? "n/a" : `${(ms / 1000).toFixed(2)} s`);

const labelKey = () =>
  tableMd(
    ["Label", "Points", "Meaning"],
    LABEL_ORDER.map((l) => [LABELS[l].text, LABELS[l].points, LABELS[l].description]),
  );

/** One section per framework × feature: label, how to enable it, gotchas, sources. */
function cellMd(cell, heading) {
  const out = [heading, `Label: **${LABELS[cell.label].text}** (${cell.points} of 2 points).`, md(cell.bodyHtml)];
  if (cell.exampleHtml) out.push("Example of building it yourself:", md(cell.exampleHtml));
  if (cell.artDirection)
    out.push(
      `Art direction with \`<picture>\` (${LABELS[cell.artDirection.label].text}, not scored):`,
      md(cell.artDirection.bodyHtml),
      md(cell.artDirection.exampleHtml),
    );
  if (cell.gotchasHtml) out.push("Gotchas:", md(cell.gotchasHtml));
  return out.filter(Boolean).join("\n\n");
}

function matrixMd(group, link = true) {
  const feats = features.filter((f) => f.group === group);
  return tableMd(
    ["Framework", ...feats.map((f) => (link ? `[${f.shortName}](${featUrl(f.id)}.md)` : f.shortName)), "Score"],
    ranked.map((fw) => [
      link ? `[${fw.name}](${fwUrl(fw.id)}.md)` : fw.name,
      ...feats.map((f) => LABELS[cellOf(fw.id, f.id).label].text),
      `${group === "fcp" ? fw.fcpScore : fw.otherScore}/${MAX[group]}`,
    ]),
  );
}

const rankingMd = () =>
  tableMd(
    ["Rank", "Framework", "First paint", "Other", "Total", "Completeness"],
    ranked.map((f) => [f.rank, `[${f.name}](${fwUrl(f.id)}.md)`, `${f.fcpScore}/${MAX.fcp}`, `${f.otherScore}/${MAX.other}`, `${f.total}/${MAX.total}`, `${f.completeness}%`]),
  );

// Build names per git branch. Keep in step with BRANCH_NAME and BRANCH_OVERRIDES in src/data/index.ts.
const BRANCH_ORDER = ["main", "optimized", "nuxt-books-optimized-max"];
const BRANCH_NAME = { main: "baseline", optimized: "optimized", "nuxt-books-optimized-max": "max optimized" };
const BRANCH_OVERRIDES = { next: { order: ["naive", "main"], names: { naive: "baseline", main: "optimized" } } };
const buildName = (b) => BRANCH_OVERRIDES[b.frameworkId]?.names[b.branch] ?? BRANCH_NAME[b.branch] ?? b.branch;
const branchRank = (b) => {
  const order = BRANCH_OVERRIDES[b.frameworkId]?.order ?? BRANCH_ORDER;
  const i = order.indexOf(b.branch);
  return i === -1 ? order.length : i;
};
const pathName = (p) => (p === "/" ? "book list (/)" : `one book (${p})`);
const run = benchmark.latest;

/** `first` picks the leading column: the framework name, or the page measured. */
function benchTable(builds, first = "framework") {
  const raw = builds.some((b) => b.fcpObs != null);
  return tableMd(
    [first === "page" ? "Page" : "Framework", "Build", "Branch", "Hosts", "Performance", "FCP", ...(raw ? ["Raw FCP"] : []), "LCP", "TBT", "CLS"],
    builds.map((b) => [
      first === "page" ? pathName(b.path) : (fwById.get(b.frameworkId)?.name ?? b.frameworkId),
      buildName(b),
      `\`${b.branch}\``,
      b.hosts.join(", "),
      n(b.perf),
      seconds(b.fcp),
      ...(raw ? [seconds(b.fcpObs)] : []),
      seconds(b.lcp),
      b.tbt == null ? "n/a" : `${n(b.tbt)} ms`,
      n(b.cls, 3),
    ]),
  );
}

const benchSorted = (path) =>
  run.builds
    .filter((b) => b.path === path)
    .sort((a, b) => (a.fcp ?? Infinity) - (b.fcp ?? Infinity) || fwById.get(a.frameworkId).order - fwById.get(b.frameworkId).order);

const benchMethod = () =>
  run
    ? `Tool: ${run.tool}, ${run.strategy} strategy. ${run.runsPerTarget} measured runs per deployment, median reported; cold runs are left out of the median when a warm run exists. Each build's figure is the average of its hosts' medians (${run.hosts.join(", ")}). Pages measured: ${run.paths.map(pathName).join(" and ")}. Times are lab values from one run on ${run.date}. FCP is the Lighthouse estimate for simulated Slow 4G; Raw FCP, where shown, is the first paint in the real, unthrottled load that estimate is built from. Builds in the same FCP band (${abs("/measured.md")}) are a tie, so read "fastest first" as band order.`
    : "No benchmark run has been published yet.";

function benchmarkBody(level = "##") {
  if (!run) return benchMethod();
  return [
    benchMethod(),
    ...run.paths.flatMap((p) => [`${level} Medians, ${pathName(p)}, fastest FCP first`, benchTable(benchSorted(p))]),
  ].join("\n\n");
}

const bandsTable = () =>
  tableMd(
    ["Band", "FCP", "What the browser waits for"],
    measured.bands.map((b) => [b.name, `${b.min}–${b.max} s`, b.shape]),
  );

function methodologyRules() {
  return [
    "### Labels",
    labelKey(),
    "The source document marks cells with three emoji: ✅ 1st-party, 🧪 experimental or third-party, 🔧 manual. This site splits 🧪 into Experimental and Third-party by the word in each cell. Both score 1 point.",
    "The source rubric:",
    md(methodology.labelsHtml),
    "### Scoring",
    `Each feature scores 2, 1 or 0 points by its label. ${features.length} features are scored: ${MAX.fcp / 2} first-paint levers (max ${MAX.fcp}) and ${MAX.other / 2} other features (max ${MAX.other}), ${MAX.total} points in total. Completeness is total / ${MAX.total} as a whole percent. Frameworks are ranked by total, and equal totals share a rank.`,
    `The source comparison scores 12 features out of 24 points. This site leaves its "Art-directed / modern-format images (\`<picture>\`)" row out of the score and shows it under Image pipeline, so the scores and ranks here can differ from the source's.`,
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const written = [];
function write(path, content) {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n" : JSON.stringify(content, null, 2) + "\n");
  written.push(path);
}

// Generated directories are rebuilt from scratch so a removed id leaves no stale file.
for (const dir of ["api", "frameworks", "features"]) rmSync(join(OUT, dir), { recursive: true, force: true });

const summary = `${site.name} compares ${features.length} speed features across ${frameworks.length} web meta-frameworks (${frameworks.map((f) => f.name).join(", ")}). Each framework × feature cell has one of four labels (1st-party, Experimental, Third-party, Manual), taken from the vendor's own documentation and linked to it. Labels score 2, 1, 1 and 0 points, which add up to a score out of ${MAX.total} and a ranking. The site also has lab measurements of the same Books demo app, ported to ${frameworks.filter((f) => f.repo).length} of them.`;

// --- Markdown twins --------------------------------------------------------

const twinFooter = (htmlPath) => `---\n\nHTML version: ${abs(htmlPath)} · All pages: ${abs("/llms.txt")} · Data: ${abs("/api/index.json")}`;

write(
  "index.md",
  [
    `# ${site.name}: the speed features meta-frameworks give you`,
    summary,
    "## Labels",
    labelKey(),
    `How labels are assigned: ${abs("/methodology.md")}`,
    "## Ranking",
    rankingMd(),
    `## Matrix: ${GROUPS.fcp.toLowerCase()}`,
    matrixMd("fcp"),
    `## Matrix: ${GROUPS.other.toLowerCase()}`,
    matrixMd("other"),
    "## Features",
    features.map((f) => `- [${f.name}](${featUrl(f.id)}.md): ${plain(f.summary)}`).join("\n"),
    "## More",
    [
      `- [FCP bands](${abs("/measured.md")}): why First Contentful Paint clusters into ${measured.bands.length} bands`,
      `- [Benchmark](${abs("/benchmark.md")}): the latest PageSpeed Insights run`,
      `- [Compare](${abs("/compare")}): pick frameworks and see them side by side (HTML only)`,
      `- [The matrix as JSON](${abs("/api/matrix.json")})`,
    ].join("\n"),
    twinFooter("/"),
  ].join("\n\n"),
);

for (const fw of frameworks) {
  const builds = run ? run.builds.filter((b) => b.frameworkId === fw.id).sort((a, b) => run.paths.indexOf(a.path) - run.paths.indexOf(b.path) || branchRank(a) - branchRank(b)) : [];
  const tied = ranked.filter((o) => o.id !== fw.id && o.rank === fw.rank).map((o) => o.name);
  write(
    `frameworks/${fw.id}.md`,
    [
      `# ${fw.name}`,
      `${fw.name} scores ${fw.total} of ${MAX.total} points on ${features.length} speed features: ${fw.fcpScore}/${MAX.fcp} on first-paint levers and ${fw.otherScore}/${MAX.other} on other features. Rank ${fw.rank} of ${frameworks.length}${tied.length ? `, tied with ${tied.join(", ")}` : ""}. Labels: ${tallyText(tallyOf(cells.filter((c) => c.frameworkId === fw.id)))}.`,
      [
        `- Version checked: ${fw.version}${fw.versionNotes ? ` (${fw.versionNotes})` : ""}`,
        `- Performance guide: [${fw.links.performanceGuide.title}](${fw.links.performanceGuide.url})`,
        `- Issue tracker: ${fw.links.issues}`,
        fw.repo ? `- Books demo port: [${fw.app}](${fw.repo})` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      "## Summary",
      tableMd(
        ["Feature", "Group", "Label", "Points"],
        features.map((f) => {
          const c = cellOf(fw.id, f.id);
          return [`[${f.name}](${featUrl(f.id)}.md)`, GROUPS[f.group], LABELS[c.label].text, c.points];
        }),
      ),
      ...Object.keys(GROUPS).flatMap((g) => [
        `## ${GROUPS[g]}`,
        ...features.filter((f) => f.group === g).map((f) => cellMd(cellOf(fw.id, f.id), `### ${f.name}`)),
      ]),
      ...(fw.extrasHtml ? ["## Other performance features", md(fw.extrasHtml)] : []),
      ...(fw.deployments.length
        ? [
            "## Deployments of the Books demo",
            tableMd(
              ["Branch", "Note", "Vercel", "Netlify", "Cloudflare"],
              fw.deployments.map((d) => [`\`${d.branch}\``, d.note || "", d.urls.vercel ?? "", d.urls.netlify ?? "", d.urls.cloudflare ?? ""]),
            ),
          ]
        : []),
      ...(builds.length ? [`## Benchmark, ${run.date}`, benchMethod(), benchTable(builds, "page"), `Full run: ${abs("/benchmark.md")}`] : []),
      twinFooter(`/frameworks/${fw.id}`),
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
}

for (const f of features) {
  const fCells = frameworks.map((fw) => cellOf(fw.id, f.id));
  write(
    `features/${f.id}.md`,
    [
      `# ${f.name}`,
      `Feature ${f.number} of ${features.length}, in the group "${GROUPS[f.group]}". Labels across ${frameworks.length} meta-frameworks: ${tallyText(tallyOf(fCells))}.`,
      "## What it is and why it matters",
      md(f.whatHtml),
      ...(f.atAGlanceHtml ? ["## At a glance", md(f.atAGlanceHtml)] : []),
      ...(f.gotchasHtml ? ["## Gotchas", md(f.gotchasHtml)] : []),
      "## Labels",
      tableMd(
        ["Framework", "Label", "Points"],
        fCells.map((c) => [`[${fwById.get(c.frameworkId).name}](${fwUrl(c.frameworkId)}.md)`, LABELS[c.label].text, c.points]),
      ),
      "## How to enable it in each framework",
      ...fCells.map((c) => cellMd(c, `### ${fwById.get(c.frameworkId).name}`)),
      twinFooter(`/features/${f.id}`),
    ].join("\n\n"),
  );
}

write(
  "methodology.md",
  [
    "# Methodology",
    `How each of the ${frameworks.length} meta-frameworks gets a label for each of the ${features.length} features, how the labels add up to scores and a ranking, and which versions were checked.`,
    methodologyRules().replace(/^### /gm, "## "),
    "## The source's scoring text",
    md(methodology.scoringHtml),
    md(methodology.rankingHtml, 1),
    "## Ranking",
    rankingMd(),
    "## Reading the other-features scores",
    md(methodology.otherFeaturesSummaryHtml),
    "## Versions checked",
    tableMd(
      ["Framework", "Version", "Notes"],
      frameworks.map((f) => [f.name, f.version, f.versionNotes || ""]),
    ),
    "## Lower-confidence claims",
    methodology.lowerConfidenceClaims.map((c, i) => `${i + 1}. ${md(c).replace(/\n/g, "\n   ")}`).join("\n"),
    twinFooter("/methodology"),
  ].join("\n\n"),
);

/** Same rules as bandOf() in src/routes/measured.tsx: clamp at the ends, null in a gap. */
const bandOf = (value) => {
  const v = Math.round(value * 10) / 10;
  const bs = measured.bands;
  if (v < bs[0].min) return bs[0];
  if (v > bs[bs.length - 1].max) return bs[bs.length - 1];
  return bs.find((b) => v >= b.min && v <= b.max) ?? null;
};
const bandLabel = (v) => {
  const b = bandOf(v);
  if (b) return b.name;
  const i = measured.bands.findIndex((b) => b.min > Math.round(v * 10) / 10);
  return `between ${measured.bands[i - 1].name} and ${measured.bands[i].name}`;
};
const fwName = (id) => frameworks.find((f) => f.id === id)?.name ?? id;
/** Sort key: band index, or halfway between two bands for a value in a gap. Same as bandRank() in src/routes/measured.tsx. */
const bandRank = (v) => {
  const b = bandOf(v);
  return b ? measured.bands.indexOf(b) : measured.bands.findIndex((x) => x.min > Math.round(v * 10) / 10) - 0.5;
};
const medianOf = (vs) => {
  const s = [...vs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
/** Home-page FCP per port, naive (default settings) vs optimized: median across hosts, seconds. Same as fcpPairs() in src/data/index.ts. */
const fcpPairs = run
  ? [...new Set(run.targets.map((t) => t.frameworkId))]
      .map((id) => {
        const of = (build) =>
          medianOf(run.targets.filter((t) => t.frameworkId === id && t.path === "/" && buildName(t) === build && t.median?.fcp != null).map((t) => t.median.fcp / 1000));
        return { frameworkId: id, naive: of("baseline"), optimized: of("optimized") };
      })
      .filter((p) => p.naive != null && p.optimized != null)
      .sort((a, b) => bandRank(b.naive) - bandRank(a.naive) || bandRank(b.optimized) - bandRank(a.optimized) || fwName(a.frameworkId).localeCompare(fwName(b.frameworkId)))
  : [];
/** Earlier single-run averages, naive vs optimized, for the ports measured with the full Google Fonts waterfall. */
const earlierPairs = measured.averages
  .filter((a) => a.build === "baseline")
  .map((a) => ({ frameworkId: a.frameworkId, naive: a.fcp, optimized: measured.averages.find((o) => o.frameworkId === a.frameworkId && o.build === "optimized")?.fcp ?? null }))
  .filter((p) => p.optimized != null);
const pairTable = (pairs, digits) =>
  tableMd(
    ["Port", "Naive FCP", "Optimized FCP", "Band"],
    pairs.map((p) => {
      const [a, b] = [bandLabel(p.naive), bandLabel(p.optimized)];
      return [fwName(p.frameworkId), `${p.naive.toFixed(digits)} s`, `${p.optimized.toFixed(digits)} s`, a === b ? `${b} either way` : `${a} → ${b}`];
    }),
  );

write(
  "measured.md",
  [
    `# Why FCP comes in ${measured.bands.length} bands`,
    `The same Books app in ${fcpPairs.length} frameworks, built twice each: once with the framework's default settings (naive) and once optimized. Mobile Lighthouse, simulated Slow 4G, 4× CPU throttle.`,
    fcpSummary(),
    "## Every port, naive vs optimized",
    `Home-page FCP. Each figure is the median across ${run?.hosts.length ?? 0} hosts (${run?.hosts.join(", ") ?? ""}) of each host's median PageSpeed Insights run. Rows are sorted by band, slowest naive band first, then by name; inside a band the order says nothing about speed. Per-host numbers: ${abs("/benchmark.md")}`,
    pairTable(fcpPairs, 2),
    "## What each band waits on",
    ...measured.bands.flatMap((b) => [`### ${b.name} (${b.min}–${b.max} s): ${b.anatomyTitle}`, md(story.bands[b.id] ?? b.anatomyHtml)]),
    "## Why FCP moves in steps",
    md(story.whyHtml),
    "## Where the Baseline band comes from",
    md(story.earlierHtml),
    pairTable(earlierPairs, 1),
    md(story.earlierNoteHtml),
    "## How to move an app into a faster band",
    ...measured.steps.flatMap((s, i) => [`### ${i + 1}. ${s.title}`, md(s.html)]),
    "## In one sentence",
    md(measured.oneSentenceHtml),
    "## Limits of these measurements",
    [
      `- ${md(story.tieHtml)}`,
      "- **Lab data only.** Mobile Lighthouse results on a cold, throttled first load. Real users with warm caches, faster connections or repeat visits see different numbers.",
      "- **First load only.** Prefetching, navigating on pointer-down and keeping data in memory make an app feel faster after the first page, and FCP doesn't capture any of them.",
      "- **One host can sit a band higher.** A cold cache or a cold worker adds a step on that host alone. The medians smooth that out; the benchmark page shows each host.",
      "- **Inlined CSS isn't cached separately.** It downloads again with every HTML response, which suits small stylesheets and hurts large ones.",
    ].join("\n"),
    twinFooter("/measured"),
  ].join("\n\n"),
);

write(
  "benchmark.md",
  [
    run ? `# Benchmark: PageSpeed Insights run of ${run.date}` : "# Benchmark",
    benchmarkBody("##"),
    run ? `Per-host medians for all ${run.targets.length} deployments: ${abs("/api/benchmark.json")}` : "",
    twinFooter("/benchmark"),
  ].join("\n\n"),
);

// --- JSON ------------------------------------------------------------------

const labelsJson = LABEL_ORDER.map((id) => ({ id, text: LABELS[id].text, points: LABELS[id].points, description: LABELS[id].description }));
const scoring = { pointsPerFeature: 2, maxScore: MAX, completeness: `round(100 * total / ${MAX.total})`, ranking: "By total, highest first. Equal totals share a rank." };

write("api/frameworks.json", {
  count: frameworks.length,
  maxScore: MAX,
  frameworks: frameworks.map((f) => ({
    id: f.id,
    name: f.name,
    shortName: f.shortName,
    version: f.version,
    versionNotes: f.versionNotes,
    rank: f.rank,
    fcpScore: f.fcpScore,
    otherScore: f.otherScore,
    total: f.total,
    completeness: f.completeness,
    labelCounts: tallyOf(cells.filter((c) => c.frameworkId === f.id)),
    performanceGuide: { url: f.links.performanceGuide.url, title: f.links.performanceGuide.title },
    issues: f.links.issues,
    demo: { app: f.app, repo: f.repo, deployments: f.deployments },
    url: fwUrl(f.id),
    markdownUrl: `${fwUrl(f.id)}.md`,
  })),
});

write("api/features.json", {
  count: features.length,
  groups: Object.entries(GROUPS).map(([id, name]) => ({ id, name, maxScore: MAX[id] })),
  features: features.map((f) => ({
    id: f.id,
    number: f.number,
    name: f.name,
    shortName: f.shortName,
    group: f.group,
    summary: f.summary,
    labelCounts: tallyOf(cells.filter((c) => c.featureId === f.id)),
    url: featUrl(f.id),
    markdownUrl: `${featUrl(f.id)}.md`,
  })),
});

write("api/matrix.json", {
  frameworks: frameworks.map((f) => f.id),
  features: features.map((f) => f.id),
  labels: labelsJson,
  scoring,
  cells: cells.map((c) => ({
    frameworkId: c.frameworkId,
    featureId: c.featureId,
    label: c.label,
    points: c.points,
    summary: firstPara(c.bodyHtml),
    sources: sources(c.bodyHtml),
    url: cellUrl(c),
  })),
});

write("api/benchmark.json", {
  run: run && {
    date: run.date,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    tool: run.tool,
    strategy: run.strategy,
    runsPerTarget: run.runsPerTarget,
    aborted: run.aborted,
    paths: run.paths,
    hosts: run.hosts,
  },
  units: {
    perf: "Lighthouse Performance score, 0-100",
    fcp: "First Contentful Paint, ms. Lighthouse's estimate for simulated Slow 4G",
    fcpObs: "First Contentful Paint in the real, unthrottled load the estimate is built from, ms",
    lcp: "Largest Contentful Paint, ms",
    lcpObs: "Largest Contentful Paint in the real, unthrottled load, ms",
    tbt: "Total Blocking Time, ms",
    si: "Speed Index, ms",
    cls: "Cumulative Layout Shift, unitless",
    doc: "Document request time, ms",
  },
  builds: run ? run.builds.map((b) => ({ frameworkId: b.frameworkId, branch: b.branch, build: buildName(b), path: b.path, hosts: b.hosts, perf: b.perf, fcp: b.fcp, fcpObs: b.fcpObs ?? null, lcp: b.lcp, lcpObs: b.lcpObs ?? null, tbt: b.tbt, si: b.si, cls: b.cls, doc: b.doc })) : [],
  targets: run ? run.targets.map((t) => ({ frameworkId: t.frameworkId, app: t.app, branch: t.branch, build: buildName(t), host: t.host, path: t.path, url: t.url, median: t.median, runs: t.runs, usedRuns: t.usedRuns, coldSuspect: t.coldSuspect, error: t.error })) : [],
  history: benchmark.history.map((h) => ({ date: h.date, targets: h.targets, withData: h.withData })),
});

write("api/fcp-bands.json", {
  bands: measured.bands.map((b) => ({ id: b.id, name: b.name, minSeconds: b.min, maxSeconds: b.max, shape: b.shape })),
  pairs: fcpPairs.map((p) => ({ frameworkId: p.frameworkId, naiveSeconds: p.naive, optimizedSeconds: p.optimized, naiveBand: bandOf(p.naive)?.id ?? null, optimizedBand: bandOf(p.optimized)?.id ?? null })),
  runDate: run?.date ?? null,
  runs: measured.runs.map((r) => ({ date: r.date, title: r.title, samples: r.samples })),
  url: abs("/measured"),
  markdownUrl: abs("/measured.md"),
});

const ID = "string. Stable slug.";
write("api/index.json", {
  name: site.name,
  description: summary,
  url: ORIGIN,
  repository: site.repo,
  stability: "Field names and ids listed here are stable. New fields may be added. Every file is static, rebuilt on each deploy, and served with Access-Control-Allow-Origin: *.",
  counts: { frameworks: frameworks.length, features: features.length, cells: cells.length },
  benchmarkDate: run?.date ?? null,
  labels: labelsJson,
  scoring,
  endpoints: [
    {
      url: abs("/api/frameworks.json"),
      description: `The ${frameworks.length} meta-frameworks with version checked, scores, rank, vendor links and Books demo deployments.`,
      schema: {
        count: "number",
        maxScore: "{ fcp, other, total }: the highest possible scores",
        "frameworks[]": {
          id: ID,
          name: "string",
          shortName: "string",
          version: "string. The version the labels describe.",
          versionNotes: "string. May be empty.",
          rank: "number. 1 is best; ties share a rank.",
          fcpScore: `number, 0-${MAX.fcp}. Points on first-paint levers.`,
          otherScore: `number, 0-${MAX.other}. Points on other features.`,
          total: `number, 0-${MAX.total}`,
          completeness: "number. Whole percent of the maximum total.",
          labelCounts: "{ first-party, experimental, third-party, manual }: cells per label",
          performanceGuide: "{ url, title }: the vendor's performance guide",
          issues: "string. URL of the issue tracker.",
          demo: "{ app, repo, deployments[]: { branch, note, urls: { vercel?, netlify?, cloudflare? } } }",
          url: "string. HTML page.",
          markdownUrl: "string. Markdown version of the page.",
        },
      },
    },
    {
      url: abs("/api/features.json"),
      description: `The ${features.length} features with group, one-sentence summary and label counts.`,
      schema: {
        count: "number",
        "groups[]": "{ id: 'fcp' | 'other', name, maxScore }",
        "features[]": {
          id: ID,
          number: "number. Position in the matrix, from 1.",
          name: "string",
          shortName: "string",
          group: "'fcp' (first-paint levers) | 'other'",
          summary: "string. One plain-text sentence.",
          labelCounts: "{ first-party, experimental, third-party, manual }: frameworks per label",
          url: "string. HTML page.",
          markdownUrl: "string. Markdown version of the page.",
        },
      },
    },
    {
      url: abs("/api/matrix.json"),
      description: `All ${cells.length} framework × feature cells with label, points, a one-paragraph summary and the vendor documentation each label cites.`,
      schema: {
        frameworks: "string[]. Framework ids in source column order.",
        features: "string[]. Feature ids in matrix order.",
        "labels[]": "{ id, text, points, description }",
        scoring: "{ pointsPerFeature, maxScore, completeness, ranking }",
        "cells[]": {
          frameworkId: "string. An id from /api/frameworks.json.",
          featureId: "string. An id from /api/features.json.",
          label: "'first-party' | 'experimental' | 'third-party' | 'manual'",
          points: "0 | 1 | 2",
          summary: "string. Markdown. The first paragraph of the how-to for this cell.",
          "sources[]": "{ url, text }: every external link in the cell's how-to, in order. The first is usually the vendor page the label rests on.",
          url: "string. The cell's section on the feature page.",
        },
      },
    },
    {
      url: abs("/api/benchmark.json"),
      description: "The latest PageSpeed Insights run of the Books demo ports: medians per deployment and averages per build.",
      schema: {
        run: "{ date, startedAt, finishedAt, tool, strategy, runsPerTarget, aborted, paths[], hosts[] } | null when no run is published",
        units: "object. Unit of each metric key.",
        "builds[]": "{ frameworkId, branch, build, path, hosts[], perf, fcp, fcpObs, lcp, lcpObs, tbt, si, cls, doc }: the average of the hosts' medians. Any metric can be null.",
        "targets[]": "{ frameworkId, app, branch, build, host, path, url, median: { perf, fcp, fcpObs?, lcp, lcpObs?, tbt, si, cls, doc } | null, runs, usedRuns, coldSuspect, error }: one deployment and page",
        "history[]": "{ date, targets, withData }: every run, oldest first",
      },
    },
    {
      url: abs("/api/fcp-bands.json"),
      description: `The ${measured.bands.length} FCP bands, where each port's naive and optimized builds land, and the earlier single Lighthouse runs.`,
      schema: {
        "bands[]": "{ id, name, minSeconds, maxSeconds, shape }",
        "pairs[]": "{ frameworkId, naiveSeconds, optimizedSeconds, naiveBand, optimizedBand }: home-page FCP from the latest benchmark run, median across hosts. naive = default settings. Bands are band ids, or null for a value in the gap between two bands.",
        runDate: "string | null. Date of the benchmark run behind pairs[].",
        "runs[]": "Earlier single Lighthouse runs, read from screenshots. { date, title, samples[]: { frameworkId, rowLabel, build, fcp: { vercel, netlify, cloudflare } in seconds or null } }",
        url: "string",
        markdownUrl: "string",
      },
    },
  ],
  text: {
    llmsTxt: abs("/llms.txt"),
    llmsFullTxt: abs("/llms-full.txt"),
    sitemap: abs("/sitemap.xml"),
    markdownPages: "Add .md to a page URL: /index.md, /frameworks/<id>.md, /features/<id>.md, /methodology.md, /measured.md, /benchmark.md",
  },
});

// --- llms.txt --------------------------------------------------------------

write(
  "llms.txt",
  [
    `# ${site.name}`,
    `> ${summary}`,
    `Every page below is markdown. The HTML version is the same URL without \`.md\`. Ids are stable. For everything in one file, read [llms-full.txt](${abs("/llms-full.txt")}).`,
    "## Pages",
    [
      `- [Matrix and ranking](${abs("/index.md")}): every label in two tables, plus the ranking of all ${frameworks.length} meta-frameworks`,
      `- [Methodology](${abs("/methodology.md")}): what each label means, how scores and ranks are calculated, versions checked`,
      `- [FCP bands](${abs("/measured.md")}): why First Contentful Paint clusters into ${measured.bands.length} bands, naive vs optimized for every port`,
      `- [Benchmark](${abs("/benchmark.md")}): ${run ? `PageSpeed Insights medians from the run of ${run.date}` : "PageSpeed Insights medians"}`,
      `- [Compare](${abs("/compare")}): interactive side-by-side view of 2 to 4 frameworks (HTML only)`,
    ].join("\n"),
    "## Frameworks",
    ranked.map((f) => `- [${f.name}](${fwUrl(f.id)}.md): ${f.total}/${MAX.total} points, rank ${f.rank}. Version checked: ${f.version}`).join("\n"),
    "## Features",
    features.map((f) => `- [${f.name}](${featUrl(f.id)}.md): ${plain(f.summary)}`).join("\n"),
    "## Data",
    [
      `- [Catalog](${abs("/api/index.json")}): lists every JSON file with a description of its fields`,
      `- [Frameworks](${abs("/api/frameworks.json")}): versions, scores, ranks, vendor links, demo deployments`,
      `- [Features](${abs("/api/features.json")}): groups, summaries, label counts`,
      `- [Matrix](${abs("/api/matrix.json")}): all ${cells.length} cells with label, points and source URLs`,
      `- [Benchmark](${abs("/api/benchmark.json")}): medians per deployment and per build`,
      `- [FCP bands](${abs("/api/fcp-bands.json")}): band ranges and where each port's naive and optimized builds land`,
    ].join("\n"),
    "## Optional",
    [
      `- [Full text](${abs("/llms-full.txt")}): the matrix with a source link per cell, FCP bands, benchmark medians and methodology in one file`,
      `- [Sitemap](${abs("/sitemap.xml")}): every HTML page`,
      `- [Site source](${site.repo}): the Pracht app and the data scripts`,
      `- [Comparison source](${site.sourceRepo}): the markdown the labels are parsed from, and the Books demo ports`,
    ].join("\n"),
  ].join("\n\n"),
);

// --- llms-full.txt ---------------------------------------------------------

const srcLinks = (c) =>
  sources(c.bodyHtml)
    .slice(0, 3)
    .map((s) => `[${s.text.replace(/[[\]]/g, "")}](${s.url})`)
    .join(", ");

write(
  "llms-full.txt",
  [
    `# ${site.name}: full text`,
    `> ${summary}`,
    `Index: ${abs("/llms.txt")} · JSON: ${abs("/api/index.json")}`,
    "## Methodology",
    methodologyRules(),
    "### Versions checked",
    tableMd(
      ["Framework", "Version"],
      frameworks.map((f) => [f.name, f.version]),
    ),
    "## Ranking",
    rankingMd(),
    "## Matrix",
    `### ${GROUPS.fcp}`,
    matrixMd("fcp", false),
    `### ${GROUPS.other}`,
    matrixMd("other", false),
    "## Every cell, with sources",
    "One line per framework × feature: the label, the first paragraph of the how-to, and up to three of the links it cites. The page linked from each feature heading has the full how-to and code.",
    ...features.flatMap((f) => [
      `### ${f.number}. ${f.name}`,
      `${plain(f.summary)} Full page: ${featUrl(f.id)}.md`,
      frameworks
        .map((fw) => {
          const c = cellOf(fw.id, f.id);
          return `- **${fw.name}**: ${labelText(c.label)}. ${firstPara(c.bodyHtml)} Sources: ${srcLinks(c)}`;
        })
        .join("\n"),
    ]),
    "## FCP bands",
    fcpSummary(),
    md(measured.oneSentenceHtml),
    `Full page: ${abs("/measured.md")}`,
    `## Benchmark${run ? `, run of ${run.date}` : ""}`,
    benchmarkBody("###"),
    `Per-host medians: ${abs("/api/benchmark.json")}`,
  ].join("\n\n"),
);

// --- sitemap.xml -----------------------------------------------------------

const routes = ["/", ...features.map((f) => `/features/${f.id}`), ...frameworks.map((f) => `/frameworks/${f.id}`), "/compare", "/measured", "/benchmark", "/methodology"];
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((r) => `  <url><loc>${abs(r)}</loc></url>`).join("\n")}\n</urlset>`,
);

console.log(`build-agent-files: wrote ${written.length} files to public/ (${ORIGIN})`);
