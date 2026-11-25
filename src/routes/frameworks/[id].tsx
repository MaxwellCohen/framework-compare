import { notFound } from "@pracht/core";
import type { HeadArgs, LoaderArgs, RouteComponentProps } from "@pracht/core";
import {
  Callout,
  Container,
  ExternalLink,
  FrameworkName,
  NavLink,
  PageHeader,
  Pager,
  Prose,
  RankBadge,
  ScoreBar,
  Section,
  Stat,
  StatGroup,
  Tag,
} from "../../components/index.ts";
import { LabelTally } from "../../components/feature/LabelTally.tsx";
import { Deployments, ScorecardGroup, type ScorecardRow } from "../../components/framework/Scorecard.tsx";
import {
  cells,
  featuresInGroup,
  frameworks,
  frameworksByRank,
  getCell,
  getFramework,
  LABEL_TEXT,
  MAX_SCORE,
  MAX_TOTAL,
} from "../../data/index.ts";
import type { FeatureGroup, Framework, Label } from "../../data/index.ts";

function pagerItem(f: Framework | undefined) {
  return f ? { id: f.id, name: f.name, rank: f.rank } : null;
}

export async function loader({ params }: LoaderArgs) {
  const fw = getFramework(params.id);
  if (!fw) throw notFound(`No framework "${params.id}"`);

  const count = frameworks.length;
  const tally = { "first-party": 0, experimental: 0, "third-party": 0, manual: 0 } satisfies Record<Label, number>;
  let notOutscored = 0;
  let featureCount = 0;

  const rowsFor = (group: FeatureGroup): ScorecardRow[] =>
    featuresInGroup(group).map((feature) => {
      const cell = getCell(fw.id, feature.id);
      const all = cells.filter((c) => c.featureId === feature.id);
      const same = all.filter((c) => c.label === cell.label).length;
      const higher = all.filter((c) => c.points > cell.points).length;
      tally[cell.label] += 1;
      featureCount += 1;
      if (higher === 0) notOutscored += 1;
      const text = LABEL_TEXT[cell.label];
      return {
        feature: { id: feature.id, number: feature.number, name: feature.name, shortName: feature.shortName },
        label: cell.label,
        bodyHtml: cell.bodyHtml,
        exampleHtml: cell.exampleHtml,
        comparison:
          (same === 1
            ? `${text}: the only framework of ${count} with this label. `
            : `${text}, like ${same - 1} of the other ${count - 1} frameworks. `) +
          (higher === 0
            ? "None scores higher."
            : `${higher} ${higher === 1 ? "framework scores" : "frameworks score"} higher.`),
      };
    });

  const groups = [
    { id: "first-paint", title: "First-paint levers", score: fw.fcpScore, max: MAX_SCORE.fcp, rows: rowsFor("fcp") },
    { id: "other", title: "Other features", score: fw.otherScore, max: MAX_SCORE.other, rows: rowsFor("other") },
  ];

  const ranked = frameworksByRank();
  const index = ranked.findIndex((f) => f.id === fw.id);
  const tiedWith = ranked
    .filter((f) => f.id !== fw.id && f.rank === fw.rank)
    .map((f) => ({ id: f.id, name: f.name, shortName: f.shortName }));

  const groupSize = { core: 0, additional: 0 };
  for (const f of frameworks) groupSize[f.group] += 1;

  return {
    framework: {
      id: fw.id,
      name: fw.name,
      shortName: fw.shortName,
      group: fw.group,
      version: fw.version,
      versionNotes: fw.versionNotes,
      fcpScore: fw.fcpScore,
      otherScore: fw.otherScore,
      total: fw.total,
      completeness: fw.completeness,
      rank: fw.rank,
      app: fw.app,
      repo: fw.repo,
      deployments: fw.deployments,
      extrasHtml: fw.extrasHtml,
    },
    max: { fcp: MAX_SCORE.fcp, other: MAX_SCORE.other, total: MAX_TOTAL },
    count,
    groupSize,
    featureCount,
    tiedWith,
    groups,
    tally,
    notOutscored,
    prev: pagerItem(ranked[index - 1]),
    next: pagerItem(ranked[index + 1]),
  };
}

export function getStaticPaths() {
  return frameworks.map((f) => ({ id: f.id }));
}

export function head({ data }: HeadArgs<typeof loader>) {
  const { framework: fw, max, count } = data;
  return {
    title: `${fw.name}: ${fw.total}/${max.total} on documented performance features — Framework Compare`,
    meta: [
      {
        name: "description",
        content:
          `What ${fw.name}'s documentation says it provides for ${data.featureCount} performance features: ` +
          `${fw.total} of ${max.total} points (${fw.fcpScore}/${max.fcp} first paint, ${fw.otherScore}/${max.other} other), ` +
          `rank ${fw.rank} of ${count}. How to enable each feature, and links to the ${fw.app} port.`,
      },
    ],
  };
}

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const { framework: fw, max, count, tiedWith, groups, prev, next } = data;
  const tied = tiedWith.length > 0;
  const additional = fw.group === "additional";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Ranking", to: { route: "home", hash: "ranking" } }, { label: fw.name }]}
        title={fw.name}
        lede={
          <>
            {fw.name} scores {fw.total} of {max.total} points. That is {fw.fcpScore} of {max.fcp} on the{" "}
            {groups[0].rows.length} features that affect first paint (the moment the browser first draws content), and{" "}
            {fw.otherScore} of {max.other} on the {groups[1].rows.length} other features. Points count what {fw.name}'s
            documentation says it provides. They do not measure speed.
          </>
        }
        meta={
          <>
            <RankBadge rank={fw.rank} tied={tied} />
            <span class="text-sm text-ink-2">
              {tied ? "Tied for rank" : "Rank"} {fw.rank} of {count}
              {tied && (
                <>
                  {" "}
                  with{" "}
                  {tiedWith.map((o, i) => (
                    <>
                      {i > 0 && ", "}
                      <FrameworkName framework={o} class="font-normal" />
                    </>
                  ))}
                </>
              )}
            </span>
            <Tag>{additional ? "Additional framework" : "Core port"}</Tag>
            <ScoreBar fcp={fw.fcpScore} other={fw.otherScore} fcpMax={max.fcp} otherMax={max.other} />
          </>
        }
        aside={
          <StatGroup cols={4} class="lg:w-[30rem]">
            <Stat label="Total" value={fw.total} unit={`/${max.total}`} />
            <Stat label="Completeness" value={fw.completeness} unit="%" />
            <Stat label="First-paint" value={fw.fcpScore} unit={`/${max.fcp}`} />
            <Stat label="Other" value={fw.otherScore} unit={`/${max.other}`} />
          </StatGroup>
        }
      />

      <Container class="border-b border-rule py-5">
        <dl class="grid max-w-[56rem] gap-x-8 gap-y-3 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt class="eyebrow sm:pt-0.5">Version checked</dt>
          <dd class="num break-words text-ink">{fw.version}</dd>
          {fw.versionNotes && (
            <>
              <dt class="eyebrow sm:pt-0.5">Version notes</dt>
              <dd class="text-ink-2">{fw.versionNotes}</dd>
            </>
          )}
          <dt class="eyebrow sm:pt-0.5">Group</dt>
          <dd class="text-ink-2">
            {additional
              ? `One of ${data.groupSize.additional} additional frameworks, labelled from vendor documentation.`
              : `One of ${data.groupSize.core} core ports, with a full how-to and code samples for each feature.`}{" "}
            <NavLink to={{ route: "methodology", hash: "versions" }} class="link">
              Versions checked
            </NavLink>
          </dd>
        </dl>
        {additional && (
          <Callout kind="caveat" title="Labelled from vendor docs" class="mt-5 max-w-[56rem]">
            <p>
              The labels on this page come from {fw.name}'s documentation. They were not checked in the {fw.app} port.
              Each how-to is one paragraph with links to the docs it cites. Manual entries add a short example written for this site.{" "}
              <NavLink to={{ route: "methodology", hash: "additional-frameworks" }}>
                About the additional frameworks
              </NavLink>
              .
            </p>
          </Callout>
        )}
      </Container>

      <Section
        id="scorecard"
        title="Scorecard"
        intro={`All ${data.featureCount} features, in two groups. Each row shows ${fw.name}'s label, how that label compares across all ${count} frameworks, and how to enable the feature. Feature names link to ${fw.name}'s entry on that feature's page.`}
        class="scroll-mt-4"
      >
        <div class="max-w-[56rem]">
          <div id="comparison" class="mb-6 grid scroll-mt-4 gap-x-10 gap-y-4 sm:grid-cols-2">
            <div>
              <p class="eyebrow mb-2">
                {fw.name}'s labels across {data.featureCount} features
              </p>
              <LabelTally counts={data.tally} of={data.featureCount} noun="features" />
            </div>
            <div>
              <p class="eyebrow mb-2">How it compares</p>
              <p class="text-sm text-ink-2">
                On <span class="num font-semibold text-ink">{data.notOutscored}</span> of {data.featureCount} features, no
                framework has a higher-scoring label than {fw.name}. On the other{" "}
                <span class="num font-semibold text-ink">{data.featureCount - data.notOutscored}</span>, at least one
                does.
              </p>
            </div>
          </div>
          <div class="grid gap-6">
            {groups.map((g) => (
              <ScorecardGroup key={g.id} frameworkId={fw.id} {...g} />
            ))}
          </div>
          <p class="mt-4 text-sm text-ink-3">
            1st-party scores 2 points, Experimental and Third-party 1, Manual 0.{" "}
            <NavLink to={{ route: "methodology", hash: "scoring" }} class="link">
              How scoring works
            </NavLink>
          </p>
        </div>
      </Section>

      <Section
        id="port"
        title="The port"
        intro="The books demo app built with this framework, and where each branch is deployed."
        class="scroll-mt-4 border-t border-rule"
      >
        <div class="max-w-[56rem]">
          <dl class="mb-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
            <dt class="eyebrow sm:pt-0.5">App</dt>
            <dd class="num font-semibold text-ink">{fw.app}</dd>
            <dt class="eyebrow sm:pt-0.5">Repository</dt>
            <dd class="num break-all">
              {fw.repo ? (
                <ExternalLink href={fw.repo}>{fw.repo.replace(/^https?:\/\//, "")}</ExternalLink>
              ) : (
                <span class="text-ink-3">Not listed</span>
              )}
            </dd>
          </dl>
          {fw.deployments.length > 0 ? (
            <Deployments deployments={fw.deployments} />
          ) : (
            <p class="text-sm text-ink-3">No deployments are listed for this port.</p>
          )}
        </div>
      </Section>

      {fw.extrasHtml && (
        <Section
          id="extras"
          title="Not scored"
          intro={`Performance features the source document lists for ${fw.name} beyond the ${data.featureCount} above. They do not count toward the score.`}
          width="prose"
          class="scroll-mt-4 border-t border-rule"
        >
          <Prose html={fw.extrasHtml} />
        </Section>
      )}

      <Section class="border-t border-rule">
        <Pager
          prev={
            prev
              ? { label: prev.name, kicker: `Rank ${prev.rank}`, to: { route: "framework", id: prev.id } }
              : undefined
          }
          next={
            next
              ? { label: next.name, kicker: `Rank ${next.rank}`, to: { route: "framework", id: next.id } }
              : undefined
          }
        />
        <p class="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
          <NavLink to={{ route: "compare" }} class="link">
            Compare {fw.name} with other frameworks
          </NavLink>
          <NavLink to={{ route: "home", hash: "ranking" }} class="link">
            Full ranking
          </NavLink>
        </p>
      </Section>
    </>
  );
}
