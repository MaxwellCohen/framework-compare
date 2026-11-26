import { notFound } from "@pracht/core";
import type { HeadArgs, LoaderArgs, RouteComponentProps } from "@pracht/core";
import {
  featureNo,
  NavLink,
  PageHeader,
  Pager,
  Prose,
  Section,
  Tag,
} from "../../components/index.ts";
import {
  FeatureJumpNav,
  FrameworkBlock,
  FrameworkOverview,
  type FeatureBlock,
} from "../../components/feature/FrameworkBlocks.tsx";
import { LabelTally } from "../../components/feature/LabelTally.tsx";
import { features, featuresInGroup, frameworks, getCell, getFeature, LABEL_TEXT, MAX_SCORE, MAX_TOTAL } from "../../data/index.ts";
import type { Feature, Label } from "../../data/index.ts";
import { markdownAlternate, pageLd } from "../../agents.ts";

/** The source's own shorthand for labels, which appears inside some `*Html` fields. */
const SOURCE_MARKS = /[✅\u{1F9EA}\u{1F527}]/u;

const LABELS_IN_ORDER: Label[] = ["first-party", "experimental", "third-party", "manual"];

function pagerItem(f: Feature | undefined) {
  return f ? { id: f.id, number: f.number, name: f.name } : null;
}

export async function loader({ params }: LoaderArgs) {
  const feature = getFeature(params.id);
  if (!feature) throw notFound(`No feature "${params.id}"`);

  // Source column order.
  const blocks: FeatureBlock[] = frameworks.map((fw) => {
    const cell = getCell(fw.id, feature.id);
    return {
      framework: { id: fw.id, name: fw.name, shortName: fw.shortName, group: fw.group },
      label: cell.label,
      bodyHtml: cell.bodyHtml,
      exampleHtml: cell.exampleHtml,
      artDirection: cell.artDirection,
      gotchasHtml: cell.gotchasHtml,
    };
  });

  const tally = { "first-party": 0, experimental: 0, "third-party": 0, manual: 0 } satisfies Record<Label, number>;
  for (const b of blocks) tally[b.label] += 1;

  // `whatHtml` is one paragraph in the source; unwrap it so it can be the lede.
  const single = /^\s*<p>([\s\S]*)<\/p>\s*$/.exec(feature.whatHtml);
  const ledeHtml = single && !single[1].includes("<p>") ? single[1] : null;

  const index = features.findIndex((f) => f.id === feature.id);

  return {
    feature: {
      id: feature.id,
      number: feature.number,
      name: feature.name,
      group: feature.group,
      summary: feature.summary,
      atAGlanceHtml: feature.atAGlanceHtml,
      gotchasHtml: feature.gotchasHtml,
    },
    ledeHtml,
    whatHtml: ledeHtml ? null : feature.whatHtml,
    blocks,
    tally,
    tallyText: LABELS_IN_ORDER.map((l) => `${tally[l]} ${LABEL_TEXT[l]}`).join(", "),
    usesSourceMarks: SOURCE_MARKS.test(feature.atAGlanceHtml + feature.gotchasHtml + blocks.map((b) => b.bodyHtml).join("")),
    featureCount: features.length,
    groupCount: featuresInGroup(feature.group).length,
    groupMax: MAX_SCORE[feature.group],
    maxTotal: MAX_TOTAL,
    prev: pagerItem(features[index - 1]),
    next: pagerItem(features[index + 1]),
  };
}

export function getStaticPaths() {
  return features.map((f) => ({ id: f.id }));
}

export function head({ data }: HeadArgs<typeof loader>) {
  const { feature, blocks, tallyText } = data;
  const path = `/features/${feature.id}`;
  const title = `${feature.name}: support in ${blocks.length} frameworks — Framework Compare`;
  const description = `${feature.summary} Documented support across ${blocks.length} meta-frameworks (${tallyText}), with how to enable it in each.`;
  return {
    title,
    meta: [{ name: "description", content: description }],
    link: [markdownAlternate(path)],
    script: [pageLd("TechArticle", path, title, description, feature.name)],
  };
}

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const { feature, blocks, tally, prev, next } = data;
  const groupText = feature.group === "fcp" ? "First-paint lever" : "Other feature";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Matrix", to: { route: "home", hash: "matrix" } },
          { label: `Feature ${featureNo(feature.number)}` },
        ]}
        title={feature.name}
        lede={
          data.ledeHtml ? (
            <span class="[&_code]:font-mono [&_code]:text-[0.9em]" dangerouslySetInnerHTML={{ __html: data.ledeHtml }} />
          ) : (
            feature.summary
          )
        }
        meta={
          <>
            <Tag tone="solid">
              {featureNo(feature.number)} / {featureNo(data.featureCount)}
            </Tag>
            <Tag>{groupText}</Tag>
            <span class="text-sm text-ink-3">
              {feature.group === "fcp"
                ? `One of ${data.groupCount} features that affect first paint, the moment the browser first draws content. Together they are worth ${data.groupMax} of the ${data.maxTotal} points.`
                : `One of ${data.groupCount} features that do not affect first paint. Together they are worth ${data.groupMax} of the ${data.maxTotal} points.`}
            </span>
          </>
        }
        aside={
          <div class="lg:max-w-xs">
            <p class="eyebrow mb-2">Labels across {blocks.length} frameworks</p>
            <LabelTally counts={tally} of={blocks.length} noun="frameworks" />
          </div>
        }
      />

      <Section id="overview" title="Overview" class="scroll-mt-4">
        <div class="grid gap-6">
          {data.whatHtml && <Prose html={data.whatHtml} class="max-w-prose" />}
          {feature.atAGlanceHtml && <Prose html={feature.atAGlanceHtml} class="max-w-prose" />}
          {data.usesSourceMarks && (
            <p class="max-w-prose text-sm text-ink-3">
              Quoted text uses the source document's own marks: ✅ means 1st-party, 🧪 means Experimental or
              Third-party, and 🔧 means Manual.
            </p>
          )}
          <FrameworkOverview feature={feature} blocks={blocks} />
          <p class="max-w-prose text-sm text-ink-3">
            Labels record what each framework's documentation says it provides. They are not performance measurements.{" "}
            <NavLink to={{ route: "methodology", hash: "labels" }} class="link">
              How the labels are assigned
            </NavLink>
            .
          </p>
        </div>
      </Section>

      <Section
        id="frameworks"
        title="How to enable it, by framework"
        intro={`One card per framework, in the same order on every feature page. Where a framework has no built-in support (Manual), a short example shows how to build it yourself.`}
        class="scroll-mt-4 border-t border-rule"
      >
        <div class="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
          <FeatureJumpNav feature={feature} blocks={blocks} />
          <div class="min-w-0 max-w-[56rem]">
            <div class="grid gap-4">
              {blocks.map((b) => (
                <FrameworkBlock key={b.framework.id} feature={feature} block={b} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {feature.gotchasHtml && (
        <Section id="gotchas" title="Gotchas" width="prose" class="scroll-mt-4 border-t border-rule">
          <Prose html={feature.gotchasHtml} />
        </Section>
      )}

      <Section class="border-t border-rule">
        <Pager
          prev={
            prev
              ? { label: prev.name, kicker: `Feature ${featureNo(prev.number)}`, to: { route: "feature", id: prev.id } }
              : undefined
          }
          next={
            next
              ? { label: next.name, kicker: `Feature ${featureNo(next.number)}`, to: { route: "feature", id: next.id } }
              : undefined
          }
        />
        <p class="mt-5 text-sm text-ink-2">
          <NavLink to={{ route: "home", hash: "matrix" }} class="link">
            All {data.featureCount} features in the matrix
          </NavLink>
        </p>
      </Section>
    </>
  );
}
