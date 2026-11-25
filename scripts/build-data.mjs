#!/usr/bin/env node
/**
 * Parses the markdown sources in the parent repo into
 * src/data/generated/{capability,measured}.json (see src/data/types.ts).
 *
 *   node scripts/build-data.mjs            # sources resolved from ../../
 *   BENCH_SOURCE_DIR=/path node scripts/build-data.mjs
 *   BENCH_SOURCE_REF=docs/comparison-doc-revisions node scripts/build-data.mjs
 *     # read the sources from a git ref of the source repo, without checking it out
 *
 * The parser is driven by document structure (headings, tables, bullets).
 * The only hand-written values are the slug / shortName / alias maps below.
 * Any structural surprise, unmapped link, or score mismatch is a hard failure.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked, Renderer } from "marked";
import { bundledLanguages, createHighlighter } from "shiki";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "..");
const SOURCE_DIR = process.env.BENCH_SOURCE_DIR
  ? resolve(process.env.BENCH_SOURCE_DIR)
  : resolve(HERE, "../..");
const SOURCE_REF = process.env.BENCH_SOURCE_REF || "";
const OUT_DIR = resolve(PROJECT, "src/data/generated");
/** Site-authored code samples for Manual cells: one `<frameworkId>.md` per framework, `## <featureId>` sections. */
const EXAMPLES_DIR = resolve(PROJECT, "content/manual-examples");

// ---------------------------------------------------------------------------
// Hand-maintained maps (slugs, short names, aliases). Nothing else is.
// ---------------------------------------------------------------------------

/** Source table name → slug + short name. */
const FRAMEWORKS = {
  Next: { id: "next", shortName: "Next" },
  Nuxt: { id: "nuxt", shortName: "Nuxt" },
  SvelteKit: { id: "sveltekit", shortName: "SvelteKit" },
  SolidStart: { id: "solidstart", shortName: "SolidStart" },
  "TanStack Start (React)": { id: "tanstack-start-react", shortName: "TanStack (React)" },
  "TanStack Start (Solid)": { id: "tanstack-start-solid", shortName: "TanStack (Solid)" },
  Pracht: { id: "pracht", shortName: "Pracht" },
  Waku: { id: "waku", shortName: "Waku" },
  Ember: { id: "ember", shortName: "Ember" },
  Astro: { id: "astro", shortName: "Astro" },
  "React Router": { id: "react-router", shortName: "React Router" },
  "Qwik City": { id: "qwik-city", shortName: "Qwik" },
  "Angular (SSR)": { id: "angular", shortName: "Angular" },
  Marko: { id: "marko", shortName: "Marko" },
  Fresh: { id: "fresh", shortName: "Fresh" },
};

/** Section number (1–12) → slug + short name. */
const FEATURES = [
  { id: "css-inlining", shortName: "CSS inlining" },
  { id: "font-optimization", shortName: "Fonts" },
  { id: "image-pipeline", shortName: "Images" },
  { id: "caching", shortName: "Caching" },
  { id: "route-prefetching", shortName: "Prefetching" },
  { id: "islands", shortName: "Islands" },
  { id: "render-modes", shortName: "Render modes" },
  { id: "picture", shortName: "<picture>" },
  { id: "reactivity", shortName: "Reactivity" },
  { id: "bundle-analysis", shortName: "Bundle analysis" },
  { id: "third-party-scripts", shortName: "Scripts" },
  { id: "multi-host-deployment", shortName: "Multi-host" },
];

/**
 * Source rows the site does not score: dropped feature id → the feature it is
 * shown under. Each framework's dropped cell moves onto its host cell as
 * `artDirection`, and scores, ranks and completeness are recomputed without it.
 */
const FOLDED_FEATURES = { picture: "image-pipeline" };
const SOURCE_FEATURE_IDS = FEATURES.map((f) => f.id);

/** Short app names used in fcp-groupings.md / README averages → slug. */
const MEASURED_ALIASES = { Svelte: "sveltekit", Solid: "solidstart" };

/** README "App" column → slug. */
const APPS = {
  "next-books": "next",
  "nuxt-books": "nuxt",
  "svelte-books": "sveltekit",
  "solid-books": "solidstart",
  "tanstack-books": "tanstack-start-react",
  "tanstack-solid-books": "tanstack-start-solid",
  "pracht-books": "pracht",
  "waku-books": "waku",
  "ember-books": "ember",
  "astro-books": "astro",
  "react-router-books": "react-router",
  "qwik-books": "qwik-city",
  "angular-books": "angular",
  "marko-books": "marko",
  "fresh-books": "fresh",
};

/** Label vocabulary of the source. */
const LABEL_WORDS = {
  "1st-party": "first-party",
  Experimental: "experimental",
  "Third-party": "third-party",
  Manual: "manual",
};
const EMOJI_POINTS = { "✅": 2, "🧪": 1, "🔧": 0 };
const LABEL_POINTS = { "first-party": 2, experimental: 1, "third-party": 1, manual: 0 };

/** In-document anchors → site URLs. `#N-…` feature anchors are handled separately. */
const ANCHOR_TARGETS = [
  [/^lower-confidence-claims$/, "/methodology#lower-confidence"],
  [/^versions-checked$/, "/methodology#versions"],
  [/^how-to-read-the-labels$/, "/methodology#labels"],
  [/^how-scoring-works/, "/methodology#scoring"],
  [/^how-to-read-the-ranking$/, "/methodology#ranking"],
  [/^how-to-recompute-it$/, "/methodology#ranking"],
  [/^completeness-score-and-ranking$/, "/#ranking"],
  [/^additional-frameworks$/, "/methodology#additional-frameworks"],
  [/^other-performance-features$/, "/#matrix"],
  [/^comparison-table$/, "/#matrix"],
];
const FILE_TARGETS = {
  "fcp-groupings.md": "/measured",
  "framework-feature-comparison.md": "/",
  "README.md": "https://github.com/MaxwellCohen/books-demo#readme",
};

const HOSTS = ["vercel", "netlify", "cloudflare"];
const HOST_ABBREV = { V: "vercel", N: "netlify", CF: "cloudflare" };
const SHIKI_THEMES = { light: "github-light", dark: "github-dark" };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const problems = [];
const warnings = [];
const problem = (msg) => void problems.push(msg);
const warn = (msg) => void warnings.push(msg);
function die(msg) {
  throw new Error(msg);
}
function bailIfProblems(stage) {
  if (!problems.length) return;
  console.error(`\nbuild-data: ${problems.length} problem(s) during ${stage}:\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("\nNo files were written.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function readSource(name) {
  const path = resolve(SOURCE_DIR, name);
  if (SOURCE_REF) {
    try {
      return execFileSync("git", ["-C", SOURCE_DIR, "show", `${SOURCE_REF}:./${name}`], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      }).replace(/\r\n/g, "\n");
    } catch (err) {
      console.error(`build-data: cannot read ${name} at git ref ${SOURCE_REF} in ${SOURCE_DIR}: ${err.message}`);
      process.exit(1);
    }
  }
  try {
    return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  } catch (err) {
    console.error(`build-data: cannot read source ${path}: ${err.message}`);
    console.error("Set BENCH_SOURCE_DIR to the directory containing the markdown sources.");
    process.exit(1);
  }
}

const comparisonMd = readSource("framework-feature-comparison.md");
const groupingsMd = readSource("fcp-groupings.md");
const readmeMd = readSource("README.md");

/** `frameworkId` → `featureId` → markdown, from content/manual-examples (part of this repo, not the sources). */
const manualExamples = new Map();
if (existsSync(EXAMPLES_DIR)) {
  for (const file of readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".md")).sort()) {
    const fwId = file.replace(/\.md$/, "");
    const md = readFileSync(resolve(EXAMPLES_DIR, file), "utf8").replace(/\r\n/g, "\n");
    const byFeature = new Map();
    for (const part of md.split(/^## +/m).slice(1)) {
      const nl = part.indexOf("\n");
      byFeature.set(part.slice(0, nl).trim(), part.slice(nl + 1).trim());
    }
    manualExamples.set(fwId, byFeature);
  }
}
const exampleMarkdown = [...manualExamples.values()].flatMap((m) => [...m.values()]).join("\n\n");

// ---------------------------------------------------------------------------
// Markdown → HTML (marked + shiki), with link rewriting
// ---------------------------------------------------------------------------

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;

function discoverLangs(...docs) {
  const langs = new Set();
  for (const doc of docs) {
    let open = null;
    for (const line of doc.split("\n")) {
      const m = line.match(/^\s*(`{3,}|~{3,})\s*([^\s`]*)/);
      if (!m) continue;
      if (open === null) {
        open = m[1][0];
        if (m[2]) langs.add(m[2].toLowerCase());
      } else if (m[1][0] === open && !m[2]) {
        open = null;
      }
    }
  }
  return [...langs];
}

const seenLangs = discoverLangs(comparisonMd, groupingsMd, readmeMd, exampleMarkdown);
const knownLangs = seenLangs.filter((l) => l in bundledLanguages);
const unknownLangs = seenLangs.filter((l) => !(l in bundledLanguages) && !["text", "txt", "plain", "plaintext"].includes(l));
const highlighter = await createHighlighter({
  themes: Object.values(SHIKI_THEMES),
  langs: knownLangs,
});

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function highlight(code, lang) {
  const requested = (lang || "").trim().split(/\s+/)[0].toLowerCase();
  const resolved = knownLangs.includes(requested) ? requested : "text";
  const label = requested || "text";
  try {
    return highlighter.codeToHtml(code, {
      lang: resolved,
      themes: SHIKI_THEMES,
      defaultColor: false,
      transformers: [
        {
          pre(node) {
            node.properties["data-lang"] = label;
            delete node.properties.tabindex;
          },
        },
      ],
    });
  } catch (err) {
    warn(`shiki failed for lang "${requested}" (${err.message}); emitted plain text`);
    return `<pre class="shiki" data-lang="${escapeHtml(label)}"><code>${escapeHtml(code)}</code></pre>`;
  }
}

/** Set once the feature list is known; `#N-…` anchors resolve through it. */
let featureIdByNumber = new Map();
const unmappedLinks = new Set();

function rewriteHref(href) {
  if (/^(https?:)?\/\//i.test(href)) return { href, external: true };
  if (/^mailto:/i.test(href)) return { href, external: false };
  if (href.startsWith("#")) {
    const anchor = href.slice(1);
    const numbered = anchor.match(/^(\d+)-/);
    if (numbered) {
      const id = featureIdByNumber.get(Number(numbered[1]));
      if (id) return { href: `/features/${FOLDED_FEATURES[id] ?? id}`, external: false };
    } else {
      for (const [re, target] of ANCHOR_TARGETS) {
        if (re.test(anchor)) return { href: target, external: false };
      }
    }
    unmappedLinks.add(href);
    return { href, external: false };
  }
  const file = href.match(/^(?:\.\/)?([^/#?]+\.md)(?:#.*)?$/i);
  if (file && FILE_TARGETS[file[1]]) {
    const target = FILE_TARGETS[file[1]];
    return { href: target, external: /^https?:/.test(target) };
  }
  unmappedLinks.add(href);
  return { href, external: false };
}

const marked = new Marked({ gfm: true });
marked.use({
  renderer: {
    code(token) {
      return highlight(token.text, token.lang) + "\n";
    },
    link(token) {
      // GFM turns bare "pkg@1.2.3" into a mailto: autolink; only explicit links are links.
      if (!/^[[<]/.test(token.raw)) return this.parser.parseInline(token.tokens);
      const { href, external } = rewriteHref(token.href);
      const text = this.parser.parseInline(token.tokens);
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
      const ext = external ? ' target="_blank" rel="noopener"' : "";
      return `<a href="${escapeHtml(href)}"${title}${ext}>${text}</a>`;
    },
    table(token) {
      return `<div class="table-wrap">${Renderer.prototype.table.call(this, token)}</div>\n`;
    },
    paragraph(token) {
      const cls = token.isCaption ? ' class="caption"' : "";
      return `<p${cls}>${this.parser.parseInline(token.tokens)}</p>\n`;
    },
    heading(token) {
      return `<h${token.depth}>${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
    },
  },
});

const lex = (md) => marked.lexer(md);
const lexInline = (md) => marked.Lexer.lexInline(md, marked.defaults);
const meaningful = (tokens) => tokens.filter((t) => t.type !== "space");

/** A paragraph that is one italic run directly after a code block is that block's caption. */
function markCaptions(tokens) {
  let prev = null;
  for (const t of tokens) {
    if (t.type === "space") continue;
    if (
      t.type === "paragraph" &&
      prev?.type === "code" &&
      t.tokens?.length === 1 &&
      t.tokens[0].type === "em"
    ) {
      t.isCaption = true;
    }
    if (t.type === "list") for (const item of t.items) markCaptions(item.tokens);
    if (t.type === "blockquote") markCaptions(t.tokens);
    prev = t;
  }
  return tokens;
}

function renderTokens(tokens) {
  const list = [...tokens];
  list.links = {};
  return marked.parser(markCaptions(list)).trim();
}
const renderBlock = (md) => renderTokens(lex(md.trim()));
const renderInline = (md) => marked.parseInline(md.trim()).trim();

const hasCode = (tokens) =>
  tokens.some(
    (t) =>
      t.type === "code" ||
      (t.type === "list" && t.items.some((i) => hasCode(i.tokens))) ||
      (t.type === "blockquote" && hasCode(t.tokens)),
  );

const decodeEntities = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

function inlineText(tokens) {
  let out = "";
  for (const t of tokens) {
    if (t.type === "br") out += " ";
    else if (t.type === "codespan") out += t.text;
    else if (t.type === "html") out += t.raw;
    else if (t.tokens?.length) out += inlineText(t.tokens);
    else out += t.text ?? t.raw ?? "";
  }
  return out;
}

/** Markdown inline → plain text (no backticks, emphasis markers, or link syntax). */
function plain(md) {
  return decodeEntities(inlineText(lexInline(String(md).trim())))
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Document structure: heading tree
// ---------------------------------------------------------------------------

/**
 * @returns root node `{ depth, title, body, children }` where `title` is plain
 * text, `body` is the markdown before the first child heading.
 */
function parseTree(md) {
  const root = { depth: 0, title: "", rawTitle: "", bodyLines: [], children: [] };
  const stack = [root];
  let fence = null;
  for (const line of md.split("\n")) {
    const f = line.match(FENCE_RE) ?? line.match(/^\s+(`{3,}|~{3,})\s*([^\s`]*)/);
    if (f) {
      if (fence === null) fence = f[1][0];
      else if (f[1][0] === fence && !f[2]) fence = null;
    }
    const h = fence === null && !f ? line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/) : null;
    if (h) {
      const depth = h[1].length;
      while (stack.at(-1).depth >= depth) stack.pop();
      const node = { depth, title: plain(h[2]), rawTitle: h[2], bodyLines: [], children: [] };
      stack.at(-1).children.push(node);
      stack.push(node);
    } else {
      stack.at(-1).bodyLines.push(line);
    }
  }
  const finish = (n) => {
    n.body = n.bodyLines.join("\n").trim();
    delete n.bodyLines;
    n.children.forEach(finish);
  };
  finish(root);
  return root;
}

/** Markdown of a node's body plus all descendants (headings included, not its own). */
function fullMarkdown(node) {
  const parts = [node.body];
  for (const c of node.children) {
    parts.push(`${"#".repeat(c.depth)} ${c.rawTitle}`, fullMarkdown(c));
  }
  return parts.filter(Boolean).join("\n\n");
}

function flatten(node, out = []) {
  for (const c of node.children) {
    out.push(c);
    flatten(c, out);
  }
  return out;
}

function findSection(parent, re, what) {
  const hits = flatten(parent).filter((n) => re.test(n.title));
  if (hits.length !== 1) {
    die(`expected exactly one "${what}" heading matching ${re}, found ${hits.length}`);
  }
  return hits[0];
}

function childSection(parent, re) {
  const hits = parent.children.filter((n) => re.test(n.title));
  if (hits.length !== 1) {
    die(`section "${parent.title}": expected one sub-heading matching ${re}, found ${hits.length}`);
  }
  return hits[0];
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** marked table token → `{ header: string[], rows: string[][] }` of raw markdown cells. */
function tableOf(token) {
  return {
    header: token.header.map((c) => c.text.trim()),
    rows: token.rows.map((r) => r.map((c) => c.text.trim())),
    token,
  };
}
const tablesIn = (md) =>
  lex(md)
    .filter((t) => t.type === "table")
    .map(tableOf);

function oneTable(md, where, headerRe) {
  const hits = tablesIn(md).filter((t) => !headerRe || headerRe.test(plain(t.header[0])));
  if (hits.length !== 1) die(`${where}: expected exactly one table, found ${hits.length}`);
  return hits[0];
}

function parseLabelCell(text, where) {
  const m = text.trim().match(/^(✅|🧪|🔧)\s*(.+)$/u);
  if (!m) die(`${where}: cannot parse label "${text}"`);
  const label = LABEL_WORDS[m[2].trim()];
  if (!label) die(`${where}: unknown label word "${m[2]}"`);
  const points = EMOJI_POINTS[m[1]];
  if (LABEL_POINTS[label] !== points) {
    die(`${where}: emoji ${m[1]} (${points} pts) disagrees with label "${m[2]}"`);
  }
  return { label, points };
}

const intOf = (text, where) => {
  const n = Number(plain(text).replace(/%$/, ""));
  if (!Number.isInteger(n)) die(`${where}: "${text}" is not an integer`);
  return n;
};

// ---------------------------------------------------------------------------
// Contract: read the slug unions out of types.ts
// ---------------------------------------------------------------------------

const typesSrc = readFileSync(resolve(PROJECT, "src/data/types.ts"), "utf8");
function unionOf(name) {
  const m = typesSrc.match(new RegExp(`export type ${name}\\s*=([^;]+);`));
  if (!m) die(`types.ts: cannot find union type ${name}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
const FRAMEWORK_IDS = unionOf("FrameworkId");
const FEATURE_IDS = unionOf("FeatureId");
const BUILD_KINDS = unionOf("BuildKind");
const BAND_IDS = [...typesSrc.match(/interface FcpBand \{[\s\S]*?id:([^;]+);/)[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);

// ---------------------------------------------------------------------------
// Capability data — framework-feature-comparison.md
// ---------------------------------------------------------------------------

function frameworkByName(name, where) {
  const fw = FRAMEWORKS[name];
  if (!fw) die(`${where}: unknown framework "${name}" (add it to FRAMEWORKS and types.ts)`);
  return fw;
}

function buildCapability() {
  const tree = parseTree(comparisonMd);
  const doc = tree.children.length === 1 ? tree.children[0] : die("comparison: expected a single H1");
  const top = doc.children;

  // --- Score tables: every H2 whose body holds an "Item" table with a score row.
  const scoreTables = [];
  for (const sec of top) {
    for (const t of tablesIn(sec.body)) {
      if (plain(t.header[0]) !== "Item") continue;
      const scoreRow = t.rows.find((r) => /^Score \(max \d+\)$/.test(plain(r[0])));
      if (!scoreRow) die(`table in "${sec.title}" has no score row`);
      const max = Number(plain(scoreRow[0]).match(/max (\d+)/)[1]);
      const group = max === 10 ? "fcp" : max === 14 ? "other" : die(`"${sec.title}": unexpected max ${max}`);
      scoreTables.push({
        section: sec,
        group,
        frameworks: t.header.slice(1).map(plain),
        rows: t.rows.filter((r) => r !== scoreRow),
        scoreRow,
      });
    }
  }
  if (scoreTables.length !== 4) die(`expected 4 score tables, found ${scoreTables.length}`);

  // --- Features, from the row names (fcp rows first, then other), numbered 1–12.
  const featureRows = [];
  for (const group of ["fcp", "other"]) {
    const tables = scoreTables.filter((t) => t.group === group);
    const names = tables[0].rows.map((r) => plain(r[0]));
    for (const t of tables.slice(1)) {
      const other = t.rows.map((r) => plain(r[0]));
      if (other.join("|") !== names.join("|")) {
        die(`"${t.section.title}" rows differ from "${tables[0].section.title}" rows`);
      }
    }
    for (const name of names) featureRows.push({ name, group });
  }
  if (featureRows.length !== FEATURES.length) {
    die(`expected ${FEATURES.length} feature rows across the tables, found ${featureRows.length}`);
  }
  const features = featureRows.map((r, i) => ({ ...FEATURES[i], number: i + 1, name: r.name, group: r.group }));
  featureIdByNumber = new Map(features.map((f) => [f.number, f.id]));
  const featureByName = new Map(features.map((f) => [f.name, f]));

  // --- Frameworks in column order; table labels and score rows.
  const frameworkNames = [];
  const tableLabel = new Map(); // `${fwId}:${featureId}` → {label, points}
  const tableScore = new Map(); // `${fwId}:${group}` → number
  for (const t of scoreTables) {
    t.frameworks.forEach((name, col) => {
      const fw = frameworkByName(name, `table "${t.section.title}"`);
      if (!frameworkNames.includes(name)) frameworkNames.push(name);
      for (const row of t.rows) {
        const feature = featureByName.get(plain(row[0]));
        const key = `${fw.id}:${feature.id}`;
        if (tableLabel.has(key)) die(`duplicate table cell ${key}`);
        tableLabel.set(key, parseLabelCell(plain(row[col + 1]), `table cell ${name} × ${feature.name}`));
      }
      tableScore.set(`${fw.id}:${t.group}`, intOf(t.scoreRow[col + 1], `score row ${name}`));
    });
  }

  // --- Versions checked (defines the "core" set).
  const versionsSec = findSection(doc, /^Versions checked$/, "Versions checked");
  const versionsTable = oneTable(versionsSec.body, "Versions checked");
  const coreVersions = new Map();
  for (const row of versionsTable.rows) {
    const fw = frameworkByName(plain(row[0]), "Versions checked");
    coreVersions.set(fw.id, { version: plain(row[1]), versionNotes: plain(row[2] ?? "") });
  }

  // --- Feature sections 1–12.
  const cells = new Map();
  const addCell = (fwId, featureId, label, points, bodyTokens, where) => {
    const key = `${fwId}:${featureId}`;
    if (cells.has(key)) return problem(`${where}: duplicate cell ${key}`);
    cells.set(key, {
      frameworkId: fwId,
      featureId,
      label,
      points,
      bodyHtml: renderTokens(bodyTokens),
      hasSnippet: hasCode(bodyTokens),
    });
  };

  const numbered = top.filter((s) => /^\d+\.\s/.test(s.title));
  if (numbered.map((s) => Number(s.title.match(/^\d+/)[0])).join() !== features.map((f) => f.number).join()) {
    die(`numbered feature sections are not exactly 1–${features.length} in order`);
  }
  for (const sec of numbered) {
    const feature = features[Number(sec.title.match(/^\d+/)[0]) - 1];
    const where = `section ${feature.number} (${feature.name})`;
    if (sec.body) warn(`${where}: text between the section heading and its first sub-heading is not carried`);

    const what = childSection(sec, /^What it is and why it matters$/);
    const whatTokens = lex(what.body);
    const glanceIdx = whatTokens.findIndex((t) => t.type === "paragraph" && /^\*\*At a glance:?\*\*:?/.test(t.raw));
    const glance = glanceIdx >= 0 ? whatTokens[glanceIdx] : null;
    const rest = whatTokens.filter((t) => t !== glance);
    const firstPara = meaningful(rest).find((t) => t.type === "paragraph");
    if (!firstPara) die(`${where}: "What it is" has no paragraph`);
    const firstText = plain(firstPara.text);
    feature.summary = (firstText.match(/^.*?[.!?](?=\s+[A-Z(“"]|$)/) ?? [firstText])[0];
    feature.whatHtml = renderTokens(rest);
    feature.atAGlanceHtml = glance
      ? renderBlock(glance.raw.replace(/^\*\*At a glance:?\*\*:?\s*/, ""))
      : "";

    const gotchas = childSection(sec, /^Gotchas$/);
    feature.gotchasHtml = renderBlock(fullMarkdown(gotchas));

    const how = childSection(sec, /^How to enable it$/);
    if (how.body) warn(`${where}: text before the first framework sub-section is not carried`);
    for (const sub of how.children) {
      const m = sub.title.match(/^(✅|🧪|🔧)\s*(.+?)\s+—\s+(.+)$/u);
      if (!m) {
        problem(`${where}: cannot parse framework heading "${sub.title}"`);
        continue;
      }
      const fw = frameworkByName(m[2], where);
      const { label, points } = parseLabelCell(`${m[1]} ${m[3]}`, `${where}, heading "${sub.title}"`);
      addCell(fw.id, feature.id, label, points, lex(fullMarkdown(sub)), where);
    }
    const extraKids = sec.children.filter((c) => ![what, how, gotchas].includes(c));
    for (const k of extraKids) warn(`${where}: sub-section "${k.title}" is not carried`);
  }

  // --- Additional frameworks: one H2 per framework with a Version line and 12 bullets.
  const additionalVersions = new Map();
  const extras = new Map();
  for (const name of frameworkNames) {
    const fw = FRAMEWORKS[name];
    if (coreVersions.has(fw.id)) continue;
    const sec = top.find((s) => s.title === name);
    if (!sec) die(`no "## ${name}" section for additional framework`);
    const tokens = meaningful(lex(fullMarkdown(sec)));
    const versionTok = tokens.find((t) => t.type === "paragraph" && /^\*\*Version:?\*\*:?/.test(t.raw));
    if (!versionTok) die(`"## ${name}": no **Version:** line`);
    const versionText = plain(versionTok.raw.replace(/^\*\*Version:?\*\*:?\s*/, ""));
    const split = versionText.match(/^(.*?)\.(?:\s+(.*))?$/s);
    additionalVersions.set(fw.id, {
      version: (split ? split[1] : versionText).trim(),
      versionNotes: (split?.[2] ?? "").trim(),
    });

    const lists = tokens.filter((t) => t.type === "list");
    const scored = lists.find((l) => l.items.some((i) => /^\*\*.+?\*\*\s+—\s+(✅|🧪|🔧)/u.test(i.text)));
    if (!scored) die(`"## ${name}": no scored bullet list`);
    for (const item of scored.items) {
      const m = item.text.match(/^\*\*(.+?)\*\*\s+—\s+(✅|🧪|🔧)\s*([^:]+):\s*([\s\S]+)$/u);
      if (!m) {
        problem(`"## ${name}": cannot parse bullet "${item.text.slice(0, 60)}…"`);
        continue;
      }
      const feature = featureByName.get(plain(m[1]));
      if (!feature) {
        problem(`"## ${name}": bullet "${plain(m[1])}" matches no table row`);
        continue;
      }
      const { label, points } = parseLabelCell(`${m[2]} ${m[3]}`, `"## ${name}" bullet "${feature.name}"`);
      addCell(fw.id, feature.id, label, points, lex(m[4]), `"## ${name}"`);
    }
    const extrasIdx = tokens.findIndex((t) => t.type === "paragraph" && /^Unscored extras:?$/i.test(plain(t.text)));
    const extrasList = extrasIdx >= 0 ? tokens.slice(extrasIdx + 1).find((t) => t.type === "list") : null;
    if (extrasList) extras.set(fw.id, renderTokens([extrasList]));
    else warn(`"## ${name}": no "Unscored extras" list`);
  }

  // --- Core extras: "Other performance features not scored" bullets.
  const notScored = findSection(doc, /^Other performance features not scored$/, "not scored");
  const notScoredList = meaningful(lex(notScored.body)).find((t) => t.type === "list");
  if (!notScoredList) die(`"${notScored.title}": no bullet list`);
  for (const item of notScoredList.items) {
    const m = item.text.match(/^\*\*(.+?)\*\*\s+—\s+([\s\S]+)$/);
    if (!m) {
      problem(`"${notScored.title}": cannot parse bullet "${item.text.slice(0, 60)}…"`);
      continue;
    }
    const bulletName = plain(m[1]);
    const targets = frameworkNames.filter((n) => n === bulletName || n.startsWith(`${bulletName} (`));
    if (!targets.length) {
      problem(`"${notScored.title}": bullet "${bulletName}" matches no framework`);
      continue;
    }
    const html = renderBlock(m[2]);
    for (const n of targets) extras.set(FRAMEWORKS[n].id, html);
  }

  // --- Ranking.
  const rankingSec = findSection(doc, /^Completeness score and ranking$/, "ranking");
  const rankingMd = fullMarkdown(rankingSec);
  const rankingTable = oneTable(rankingMd, "ranking", /^Rank$/);
  const ranking = rankingTable.rows.map((row) => {
    const fw = frameworkByName(plain(row[1]), "ranking table");
    return {
      rank: intOf(row[0], "ranking rank"),
      frameworkId: fw.id,
      fcpScore: intOf(row[2], `ranking ${fw.id}`),
      otherScore: intOf(row[3], `ranking ${fw.id}`),
      total: intOf(row[4], `ranking ${fw.id}`),
      completeness: intOf(row[5], `ranking ${fw.id}`),
    };
  });
  const rankById = new Map(ranking.map((r) => [r.frameworkId, r]));

  // --- README deployments.
  const deploys = parseReadmeDeployments();

  // --- Assemble frameworks.
  const frameworks = frameworkNames.map((name, order) => {
    const fw = FRAMEWORKS[name];
    const core = coreVersions.get(fw.id);
    const v = core ?? additionalVersions.get(fw.id);
    const r = rankById.get(fw.id);
    const d = deploys.get(fw.id);
    if (!r) problem(`${name}: missing from the ranking table`);
    if (!d) problem(`${name}: no deployment rows in README.md`);
    return {
      id: fw.id,
      name,
      shortName: fw.shortName,
      group: core ? "core" : "additional",
      order,
      version: v.version,
      versionNotes: v.versionNotes,
      fcpScore: r?.fcpScore ?? -1,
      otherScore: r?.otherScore ?? -1,
      total: r?.total ?? -1,
      completeness: r?.completeness ?? -1,
      rank: r?.rank ?? -1,
      app: d?.app ?? "",
      repo: d?.repo ?? null,
      deployments: d?.deployments ?? [],
      extrasHtml: extras.get(fw.id) ?? null,
    };
  });

  // --- Cells in framework × feature order.
  const orderedCells = [];
  for (const fw of frameworks) {
    for (const f of features) {
      const cell = cells.get(`${fw.id}:${f.id}`);
      if (!cell) problem(`missing cell ${fw.name} × ${f.name}`);
      else orderedCells.push(cell);
    }
  }

  // --- Site-authored samples for Manual cells (content/manual-examples).
  for (const cell of orderedCells) {
    const md = manualExamples.get(cell.frameworkId)?.get(cell.featureId);
    cell.exampleHtml = null;
    if (md === undefined) {
      if ((cell.label === "manual" || FOLDED_FEATURES[cell.featureId]) && !cell.hasSnippet) warn(`code-less cell ${cell.frameworkId} × ${cell.featureId} has no code sample`);
      continue;
    }
    if (cell.label !== "manual" && !FOLDED_FEATURES[cell.featureId]) warn(`example for ${cell.frameworkId} × ${cell.featureId} ignored: label is ${cell.label}`);
    else if (cell.hasSnippet) warn(`example for ${cell.frameworkId} × ${cell.featureId} ignored: the source already has a snippet`);
    else {
      const tokens = lex(md);
      if (!hasCode(tokens)) warn(`example for ${cell.frameworkId} × ${cell.featureId} has no code block`);
      cell.exampleHtml = renderTokens(tokens);
      // The source's "no inline example" note is answered by the sample below it.
      cell.bodyHtml = cell.bodyHtml.replace(/\s*No inline example \(unsourced\)\.?/g, "");
    }
  }
  for (const [fwId, m] of manualExamples) {
    for (const featureId of m.keys()) {
      if (!cells.has(`${fwId}:${featureId}`)) warn(`content/manual-examples/${fwId}.md: no cell for "${featureId}"`);
    }
  }

  // --- Methodology prose.
  const disclaimerTok = meaningful(lex(doc.body)).find((t) => t.type === "blockquote");
  if (!disclaimerTok) die("comparison: no disclaimer blockquote under the H1");
  const otherSec = scoreTables.find((t) => t.group === "other" && coreVersions.has(FRAMEWORKS[t.frameworks[0]].id)).section;
  const otherTokens = lex(otherSec.body);
  const afterTable = otherTokens.slice(otherTokens.findIndex((t) => t.type === "table") + 1);
  const claimsSec = findSection(doc, /^Lower-confidence claims$/, "lower-confidence claims");
  const claimsList = meaningful(lex(claimsSec.body)).find((t) => t.type === "list");
  if (!claimsList) die("Lower-confidence claims: no bullet list");

  const methodology = {
    disclaimerHtml: renderTokens(disclaimerTok.tokens),
    labelsHtml: renderBlock(fullMarkdown(findSection(doc, /^How to read the labels$/, "labels"))),
    scoringHtml: renderBlock(fullMarkdown(findSection(doc, /^How scoring works/, "scoring"))),
    rankingHtml: renderTokens(lex(rankingMd).filter((t) => t.type !== "table")),
    otherFeaturesSummaryHtml: renderTokens(afterTable.filter((t) => t.type === "paragraph" || t.type === "space")),
    additionalFrameworksHtml: renderBlock(findSection(doc, /^Additional frameworks$/, "additional frameworks").body),
    lowerConfidenceClaims: claimsList.items.map((item) =>
      meaningful(item.tokens).length === 1 ? renderInline(item.text) : renderTokens(item.tokens),
    ),
  };

  validateCapability({ frameworks, features, cells: orderedCells, ranking, tableLabel, tableScore });
  return { ...foldFeatures({ frameworks, features, cells: orderedCells }), methodology };
}

/**
 * Applies FOLDED_FEATURES after the source has been validated as written:
 * moves each dropped cell onto its host cell, renumbers the features, and
 * recomputes every score, completeness percentage and competition rank.
 */
function foldFeatures({ frameworks, features, cells }) {
  for (const cell of cells) cell.artDirection = null;
  for (const [dropped, host] of Object.entries(FOLDED_FEATURES)) {
    for (const cell of cells.filter((c) => c.featureId === dropped)) {
      const target = cells.find((c) => c.frameworkId === cell.frameworkId && c.featureId === host);
      if (!target) die(`fold ${dropped} → ${host}: no ${host} cell for ${cell.frameworkId}`);
      target.artDirection = { label: cell.label, bodyHtml: cell.bodyHtml, exampleHtml: cell.exampleHtml };
    }
  }
  const keptFeatures = features.filter((f) => !FOLDED_FEATURES[f.id]).map((f, i) => ({ ...f, number: i + 1 }));
  const keptCells = cells.filter((c) => !FOLDED_FEATURES[c.featureId]);
  const groupOf = new Map(keptFeatures.map((f) => [f.id, f.group]));
  const maxTotal = 2 * keptFeatures.length;

  for (const fw of frameworks) {
    const sums = { fcp: 0, other: 0 };
    for (const c of keptCells) if (c.frameworkId === fw.id) sums[groupOf.get(c.featureId)] += c.points;
    fw.fcpScore = sums.fcp;
    fw.otherScore = sums.other;
    fw.total = sums.fcp + sums.other;
    fw.completeness = Math.round((fw.total / maxTotal) * 100);
  }
  for (const fw of frameworks) fw.rank = 1 + frameworks.filter((o) => o.total > fw.total).length;
  const ranking = [...frameworks]
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((fw) => ({
      rank: fw.rank,
      frameworkId: fw.id,
      fcpScore: fw.fcpScore,
      otherScore: fw.otherScore,
      total: fw.total,
      completeness: fw.completeness,
    }));

  const ids = keptFeatures.map((f) => f.id);
  if (ids.length !== FEATURE_IDS.length || ids.some((id, i) => id !== FEATURE_IDS[i])) {
    problem(`features after folding [${ids}] differ from FeatureId in types.ts [${FEATURE_IDS}]`);
  }
  const missing = keptCells.filter((c) => c.featureId in Object.fromEntries(Object.values(FOLDED_FEATURES).map((h) => [h, 1])) && !c.artDirection);
  for (const c of missing) problem(`cell ${c.frameworkId} × ${c.featureId}: no folded artDirection`);
  return { frameworks, features: keptFeatures, cells: keptCells, ranking };
}

function validateCapability({ frameworks, features, cells, ranking, tableLabel, tableScore }) {
  if (frameworks.length !== 15) problem(`expected 15 frameworks, found ${frameworks.length}`);
  if (features.length !== 12) problem(`expected 12 features, found ${features.length}`);
  if (cells.length !== 180) problem(`expected 180 cells, found ${cells.length}`);
  if (ranking.length !== frameworks.length) problem(`ranking has ${ranking.length} rows for ${frameworks.length} frameworks`);

  const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (!sameSet(frameworks.map((f) => f.id), FRAMEWORK_IDS)) {
    problem(`framework ids [${frameworks.map((f) => f.id)}] differ from FrameworkId in types.ts [${FRAMEWORK_IDS}]`);
  }
  if (!sameSet(features.map((f) => f.id), SOURCE_FEATURE_IDS)) {
    problem(`feature ids [${features.map((f) => f.id)}] differ from the FEATURES map [${SOURCE_FEATURE_IDS}]`);
  }
  const core = frameworks.filter((f) => f.group === "core").length;
  if (core !== 9) problem(`expected 9 core frameworks, found ${core}`);

  const featureById = new Map(features.map((f) => [f.id, f]));
  for (const cell of cells) {
    const where = `cell ${cell.frameworkId} × ${cell.featureId}`;
    if (!FRAMEWORK_IDS.includes(cell.frameworkId)) problem(`${where}: frameworkId outside FrameworkId`);
    if (!SOURCE_FEATURE_IDS.includes(cell.featureId)) problem(`${where}: featureId outside the FEATURES map`);
    if (!cell.bodyHtml.replace(/<[^>]+>/g, "").trim()) problem(`${where}: empty bodyHtml`);
    const t = tableLabel.get(`${cell.frameworkId}:${cell.featureId}`);
    if (!t) problem(`${where}: no table cell`);
    else if (t.label !== cell.label) {
      problem(`${where}: table says "${t.label}" but the section heading / bullet says "${cell.label}"`);
    }
  }

  for (const fw of frameworks) {
    const sums = { fcp: 0, other: 0 };
    for (const c of cells) {
      if (c.frameworkId === fw.id) sums[featureById.get(c.featureId)?.group] += c.points;
    }
    for (const [group, field] of [["fcp", "fcpScore"], ["other", "otherScore"]]) {
      const row = tableScore.get(`${fw.id}:${group}`);
      if (sums[group] !== row || row !== fw[field]) {
        problem(`${fw.name} ${group}: cell points sum to ${sums[group]}, score row says ${row}, ranking table says ${fw[field]}`);
      }
    }
    if (fw.total !== fw.fcpScore + fw.otherScore) {
      problem(`${fw.name}: total ${fw.total} ≠ ${fw.fcpScore} + ${fw.otherScore}`);
    }
    const pct = Math.round((fw.total / 24) * 100);
    if (fw.completeness !== pct) problem(`${fw.name}: completeness ${fw.completeness}% ≠ round(${fw.total}/24) = ${pct}%`);
    if (!fw.version) problem(`${fw.name}: empty version`);
    if (!fw.app) problem(`${fw.name}: empty app`);
  }

  // Ranks must be competition ranks by total (ties share, 1, 1, 3 …).
  for (const r of ranking) {
    const expected = 1 + ranking.filter((o) => o.total > r.total).length;
    if (r.rank !== expected) problem(`ranking: ${r.frameworkId} has rank ${r.rank}, totals imply ${expected}`);
  }

  for (const f of features) {
    for (const field of ["summary", "whatHtml", "gotchasHtml"]) {
      if (!f[field]) problem(`feature ${f.id}: empty ${field}`);
    }
  }
}

// ---------------------------------------------------------------------------
// README.md — deployments + averages
// ---------------------------------------------------------------------------

function parseReadmeDeployments() {
  const table = tablesIn(readmeMd).find((t) => plain(t.header[0]) === "App" && t.header.some((h) => plain(h) === "Branch"));
  if (!table) die("README.md: deployments table (App … Branch …) not found");
  const col = (name) => {
    const i = table.header.findIndex((h) => plain(h).toLowerCase() === name);
    if (i < 0) die(`README.md deployments table: no "${name}" column`);
    return i;
  };
  const iApp = col("app");
  const iSource = col("source");
  const iBranch = col("branch");
  const iNotes = col("notes");
  const firstHref = (cellToken) => {
    const walk = (tokens) => {
      for (const t of tokens ?? []) {
        if (t.type === "link") return t.href;
        const inner = walk(t.tokens);
        if (inner) return inner;
      }
      return null;
    };
    return walk(cellToken.tokens);
  };

  const byFramework = new Map();
  let prevRepo = null;
  table.token.rows.forEach((cells, r) => {
    const app = plain(cells[iApp].text);
    const fwId = APPS[app];
    if (!fwId) return problem(`README.md deployments: unknown app "${app}" (add it to APPS)`);
    const sourceText = plain(cells[iSource].text);
    const repo = /^same$/i.test(sourceText) ? prevRepo : firstHref(cells[iSource]);
    if (!repo) problem(`README.md deployments row ${r + 1} (${app}): no repo URL`);
    prevRepo = repo;
    const urls = {};
    for (const host of HOSTS) {
      const href = firstHref(cells[col(host)]);
      if (href) urls[host] = href;
    }
    const entry = byFramework.get(fwId) ?? { app, repo, deployments: [] };
    if (entry.repo !== repo) problem(`README.md deployments: ${app} lists two repos (${entry.repo}, ${repo})`);
    entry.deployments.push({ branch: plain(cells[iBranch].text), note: plain(cells[iNotes].text), urls });
    byFramework.set(fwId, entry);
  });
  return byFramework;
}

function measuredFrameworkId(name) {
  return FRAMEWORKS[name]?.id ?? MEASURED_ALIASES[name] ?? null;
}

function parseReadmeAverages() {
  const tree = parseTree(readmeMd);
  const sec = findSection(tree, /^Impact\b/, "README Impact");
  const table = oneTable(fullMarkdown(sec), "README Impact", /^Framework$/);
  const col = (re) => {
    const i = table.header.findIndex((h) => re.test(plain(h)));
    if (i < 0) die(`README Impact table: no column matching ${re}`);
    return i;
  };
  const [iFw, iBuild, iPerf, iFcp, iLcp] = [/^Framework$/, /^Build$/, /Perf/, /FCP/, /LCP/].map(col);
  const num = (text, where) => {
    const n = Number(plain(text));
    if (!Number.isFinite(n)) die(`${where}: "${text}" is not a number`);
    return n;
  };
  const averages = table.rows.map((row) => {
    const name = plain(row[iFw]);
    const frameworkId = measuredFrameworkId(name) ?? die(`README Impact: unknown framework "${name}"`);
    const build = plain(row[iBuild]);
    if (!BUILD_KINDS.includes(build)) die(`README Impact: build "${build}" is not a BuildKind`);
    const where = `README Impact ${name}/${build}`;
    return { frameworkId, build, perf: num(row[iPerf], where), fcp: num(row[iFcp], where), lcp: num(row[iLcp], where) };
  });
  const date = sec.title.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return { averages, date: date ? isoDate(date[3], date[1], date[2]) : null };
}

// ---------------------------------------------------------------------------
// Measured data — fcp-groupings.md
// ---------------------------------------------------------------------------

const isoDate = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function buildKindFromText(text) {
  if (/\bmax\b|max-|-max/i.test(text)) return "max-optimized";
  if (/basic cache/i.test(text)) return "basic-cache";
  if (/optimi[sz]ed/i.test(text)) return "optimized";
  if (/baseline|\bmain\b/i.test(text)) return "baseline";
  return null;
}

function fcpValue(text, where) {
  const t = text.trim();
  if (/^[—–-]$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) die(`${where}: "${text}" is not an FCP value`);
  return n;
}

function buildMeasured() {
  const tree = parseTree(groupingsMd);
  const doc = tree.children.length === 1 ? tree.children[0] : die("fcp-groupings: expected a single H1");
  const { averages, date: averagesDate } = parseReadmeAverages();

  // Frameworks whose only measured build is "cached" have no baseline/optimized split.
  const buildsByFw = new Map();
  for (const a of averages) buildsByFw.set(a.frameworkId, (buildsByFw.get(a.frameworkId) ?? new Set()).add(a.build));
  const alwaysCached = new Set([...buildsByFw].filter(([, s]) => s.size === 1 && s.has("cached")).map(([id]) => id));

  const disclaimerTok = meaningful(lex(doc.body)).find((t) => t.type === "blockquote");
  if (!disclaimerTok) die("fcp-groupings: no disclaimer blockquote under the H1");
  const year = disclaimerTok.raw.match(/\b(20\d{2})-\d{2}-\d{2}\b/)?.[1] ?? averagesDate?.slice(0, 4);
  if (!year) die("fcp-groupings: cannot determine the year of the runs");

  // --- Summary + bands.
  const summarySec = findSection(doc, /^Summary$/, "Summary");
  const summaryTokens = lex(summarySec.body);
  const bandTable = oneTable(summarySec.body, "fcp-groupings Summary", /^Band$/);
  const anatomySec = findSection(doc, /^Band-by-band anatomy$/, "band anatomy");
  const range = (text) => {
    const m = plain(text).match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*s/);
    return m ? { min: Number(m[1]), max: Number(m[2]) } : null;
  };
  const bands = bandTable.rows.map((row) => {
    const name = plain(row[0]);
    const id = name.toLowerCase().replace(/[^a-z]+/g, "-");
    if (!BAND_IDS.includes(id)) die(`band "${name}" → id "${id}" is not in FcpBand["id"]`);
    const r = range(row[1]) ?? die(`band "${name}": cannot parse range "${row[1]}"`);
    const anatomy = anatomySec.children.filter((c) => {
      const cr = range(c.title);
      return cr && cr.min === r.min && cr.max === r.max;
    });
    if (anatomy.length !== 1) die(`band "${name}": expected one anatomy sub-section for ${r.min}–${r.max}s, found ${anatomy.length}`);
    return {
      id,
      name,
      ...r,
      shape: plain(row[2]),
      anatomyTitle: anatomy[0].title.replace(/^[^:]*:\s*/, ""),
      anatomyHtml: renderBlock(fullMarkdown(anatomy[0])),
    };
  });
  if (bands.length !== anatomySec.children.length) {
    problem(`${bands.length} bands but ${anatomySec.children.length} anatomy sub-sections`);
  }

  // --- Runs.
  const dataSec = findSection(doc, /^The data$/, "The data");
  const runs = dataSec.children.map((sec) => {
    const m = sec.title.match(/^(\d{1,2})\/(\d{1,2}) run\s+[—–-]\s+(.*)$/);
    if (!m) die(`"The data": cannot parse run heading "${sec.title}"`);
    const id = isoDate(year, m[1], m[2]);
    const title = m[3];
    const where = `run ${id}`;
    const tokens = lex(sec.body);
    const tableIdx = tokens.findIndex((t) => t.type === "table");
    if (tableIdx < 0) die(`${where}: no table`);
    const table = tableOf(tokens[tableIdx]);
    const titleFw = Object.keys(FRAMEWORKS).find((n) => new RegExp(`\\b${n.replace(/[()]/g, "\\$&")}\\b`).test(title));

    const hostCols = [];
    const tripleCols = [];
    table.header.forEach((h, i) => {
      if (i === 0) return;
      const text = plain(h);
      const triple = text.match(/^(.*?)\s*\(([^)]+)\)$/);
      const abbrevs = triple?.[2].split("/").map((s) => s.trim());
      if (abbrevs?.length === 3 && abbrevs.every((a) => HOST_ABBREV[a])) {
        tripleCols.push({ i, build: buildKindFromText(triple[1]) ?? die(`${where}: no build kind in column "${text}"`), hosts: abbrevs.map((a) => HOST_ABBREV[a]) });
      } else if (HOSTS.includes(text.toLowerCase())) {
        hostCols.push({ i, host: text.toLowerCase() });
      } else die(`${where}: unrecognised column "${text}"`);
    });
    if (tripleCols.length && hostCols.length) die(`${where}: mixed column styles`);
    if (!tripleCols.length && hostCols.length !== 3) die(`${where}: expected Vercel/Netlify/Cloudflare columns`);

    const samples = [];
    for (const row of table.rows) {
      const rowLabel = row[0];
      const rowName = plain(rowLabel);
      const rowFw = measuredFrameworkId(rowName);
      const frameworkId = rowFw ?? (titleFw ? FRAMEWORKS[titleFw].id : null);
      if (!frameworkId) {
        problem(`${where}: cannot map row "${rowName}" to a framework`);
        continue;
      }
      const finalBuild = (b) => (alwaysCached.has(frameworkId) ? "cached" : b);
      if (tripleCols.length) {
        for (const c of tripleCols) {
          const text = plain(row[c.i]);
          if (/^[—–-]$/.test(text)) continue; // no deploy of this kind for this app
          const parts = text.split("/").map((s) => s.trim());
          if (parts.length !== 3) die(`${where}, ${rowName}: expected three values in "${text}"`);
          const fcp = Object.fromEntries(c.hosts.map((h, k) => [h, fcpValue(parts[k], `${where}, ${rowName}`)]));
          samples.push({ frameworkId, rowLabel, build: finalBuild(c.build), fcp: orderHosts(fcp) });
        }
      } else {
        const build = (rowFw ? null : buildKindFromText(rowName)) ?? buildKindFromText(title);
        if (!build) die(`${where}, ${rowName}: cannot infer a build kind`);
        const fcp = Object.fromEntries(hostCols.map((c) => [c.host, fcpValue(plain(row[c.i]), `${where}, ${rowName}`)]));
        samples.push({ frameworkId, rowLabel, build: finalBuild(build), fcp: orderHosts(fcp) });
      }
    }
    for (const s of samples) {
      if (!BUILD_KINDS.includes(s.build)) problem(`${where}: build "${s.build}" is not a BuildKind`);
      if (!FRAMEWORK_IDS.includes(s.frameworkId)) problem(`${where}: frameworkId "${s.frameworkId}" outside FrameworkId`);
    }
    if (meaningful(tokens.slice(0, tableIdx)).length) warn(`${where}: prose before the table is not carried`);
    return { id, date: id, title: plain(title), samples, commentaryHtml: renderTokens(tokens.slice(tableIdx + 1)) };
  });
  if (!runs.length) die('"The data": no runs');
  if (averagesDate && !runs.some((r) => r.id === averagesDate)) {
    warn(`README Impact table is dated ${averagesDate}, which matches no run in fcp-groupings.md`);
  }

  // --- Steps.
  const stepsSec = findSection(doc, /^How to move an app down a band$/, "steps");
  const steps = stepsSec.children.map((c) => {
    const m = c.title.match(/^\d+\.\s+(.*)$/);
    if (!m) die(`steps: heading "${c.title}" is not numbered`);
    return { title: m[1], html: renderBlock(fullMarkdown(c)) };
  });
  if (!steps.length) die("steps: none found");

  // --- One-sentence version: stop at the trailing horizontal rule.
  const oneSec = findSection(doc, /^The one-sentence version$/, "one-sentence version");
  const oneTokens = lex(oneSec.body);
  const hr = oneTokens.findIndex((t) => t.type === "hr");

  return {
    disclaimerHtml: renderTokens(disclaimerTok.tokens),
    summaryHtml: renderTokens(summaryTokens.filter((t) => t.type !== "table")),
    bands,
    runs,
    averages,
    whyBandsHtml: renderBlock(fullMarkdown(findSection(doc, /^Why the result is bands/, "why bands"))),
    whyBasicCacheHtml: renderBlock(fullMarkdown(findSection(doc, /^Why the .basic cache. run spans every band$/, "why basic cache"))),
    steps,
    caveatsHtml: renderBlock(fullMarkdown(findSection(doc, /^Caveats$/, "Caveats"))),
    oneSentenceHtml: renderTokens(hr >= 0 ? oneTokens.slice(0, hr) : oneTokens),
  };
}

const orderHosts = (fcp) => Object.fromEntries(HOSTS.map((h) => [h, fcp[h] ?? null]));

// ---------------------------------------------------------------------------
// Output checks shared by both files
// ---------------------------------------------------------------------------

function walkStrings(value, path, visit) {
  if (typeof value === "string") visit(value, path);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, visit));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walkStrings(v, path ? `${path}.${k}` : k, visit);
  }
}

const ALLOWED_TAGS = new Set(
  "a blockquote br code del div em h2 h3 h4 h5 h6 hr li ol p pre span strong table tbody td th thead tr ul".split(" "),
);
const isHtmlPath = (path) => /Html$|\.html$|lowerConfidenceClaims\[\d+\]$/.test(path);
const RAW_MARKDOWN_OK = /\.rowLabel$/; // contract keeps the row label as written

function checkOutput(name, data) {
  walkStrings(data, "", (value, path) => {
    if (isHtmlPath(path)) {
      for (const m of value.matchAll(/<\/?([a-zA-Z][\w-]*)/g)) {
        if (!ALLOWED_TAGS.has(m[1].toLowerCase())) problem(`${name} ${path}: unexpected raw <${m[1]}> tag in rendered HTML`);
      }
      for (const m of value.matchAll(/<a\s[^>]*?href="([^"]*)"/g)) {
        const href = decodeEntities(m[1]);
        const bare = href.replace(/[?#].*$/, "");
        const ok = /^https?:\/\//.test(href) || /^\/(?!\/)/.test(href) || /^mailto:/.test(href);
        if (!ok || href.startsWith("#") || href.startsWith("./") || href.startsWith("../") || (!/^https?:\/\//.test(href) && /\.md$/i.test(bare))) {
          problem(`${name} ${path}: unmapped link href="${href}"`);
        }
      }
      for (const m of value.matchAll(/<a\s[^>]*href="https?:[^>]*>/g)) {
        if (!m[0].includes('target="_blank" rel="noopener"')) problem(`${name} ${path}: external link without target/rel: ${m[0]}`);
      }
    } else if (!RAW_MARKDOWN_OK.test(path) && !/\.urls\.|\.repo$/.test(path)) {
      if (/`|\*\*|\]\(/.test(value)) problem(`${name} ${path}: plain-text field still contains markdown: ${JSON.stringify(value.slice(0, 80))}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let capability;
let measured;
try {
  capability = buildCapability();
  measured = buildMeasured();
} catch (err) {
  bailIfProblems("parsing");
  console.error(`\nbuild-data: ${err.message}\n\nNo files were written.`);
  process.exit(1);
}

for (const href of unmappedLinks) {
  problem(`unmapped link target "${href}" — add it to ANCHOR_TARGETS / FILE_TARGETS in scripts/build-data.mjs`);
}
checkOutput("capability.json", capability);
checkOutput("measured.json", measured);
bailIfProblems("validation");

mkdirSync(OUT_DIR, { recursive: true });
const written = [];
for (const [file, data] of [["capability.json", capability], ["measured.json", measured]]) {
  const json = `${JSON.stringify(data, null, 1)}\n`;
  writeFileSync(resolve(OUT_DIR, file), json);
  written.push(`${file} ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
}

const { frameworks, features, cells } = capability;
const pad = (s, n) => String(s).padEnd(n);
console.log(`build-data: sources from ${SOURCE_DIR}${SOURCE_REF ? ` at git ref ${SOURCE_REF}` : ""}`);
console.log(
  `  ${frameworks.length} frameworks (${frameworks.filter((f) => f.group === "core").length} core), ` +
    `${features.length} features, ${cells.length} cells (${cells.filter((c) => c.hasSnippet).length} with snippets), ` +
    `${capability.methodology.lowerConfidenceClaims.length} lower-confidence claims`,
);
console.log(
  `  ${measured.bands.length} bands, ${measured.runs.length} runs ` +
    `(${measured.runs.map((r) => `${r.id}: ${r.samples.length}`).join(", ")} samples), ` +
    `${measured.averages.length} averages, ${measured.steps.length} steps`,
);
console.log(`  code languages: ${seenLangs.join(", ")}${unknownLangs.length ? ` (plain-text fallback: ${unknownLangs.join(", ")})` : ""}`);
console.log(`\n  ${pad("rank", 5)}${pad("framework", 26)}${pad("fcp", 5)}${pad("other", 7)}${pad("total", 7)}%`);
for (const r of capability.ranking) {
  const fw = frameworks.find((f) => f.id === r.frameworkId);
  console.log(`  ${pad(r.rank, 5)}${pad(fw.name, 26)}${pad(r.fcpScore, 5)}${pad(r.otherScore, 7)}${pad(r.total, 7)}${r.completeness}`);
}
if (warnings.length) {
  console.log(`\n  ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
console.log(`\n  wrote ${written.join(", ")} → ${OUT_DIR}`);
