import type { IslandProps } from "@pracht/core";
import { useEffect, useState } from "preact/hooks";
import { FeatureChip, FeatureName } from "../components/Chips.tsx";
import { LabelBadge, LabelLegend, LABELS } from "../components/LabelBadge.tsx";
import { CompareMatrix, featureHref, frameworkHref } from "../components/compare/CompareMatrix.tsx";
import { Card, Section, Tag } from "../components/Page.tsx";
import { RankBadge, ScoreBar } from "../components/Score.tsx";
import {
  LABEL_CODES,
  MAX_PICK,
  MIN_PICK,
  parseSelection,
  type CompareFeature,
  type CompareFramework,
} from "../components/compare/model.ts";
import type { FrameworkId, Label } from "../data/types.ts";

interface CompareViewProps {
  /** All frameworks in rank order, each with its 12 labels packed into `labels`. */
  frameworks: CompareFramework[];
  /** All features in source order (the order of the characters in `labels`). */
  features: CompareFeature[];
  /** Selection shown when the URL has no valid `?f=`; also what the server renders. */
  initial: FrameworkId[];
}

const COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The whole interactive part of /compare: picker, scores, narrowed matrix and
 * the list of features where the picked frameworks differ. Selection lives in
 * `?f=id,id,id`; the server render (and the no-JS page) shows `initial`.
 */
export default function CompareView({ frameworks, features, initial }: CompareViewProps & IslandProps) {
  const [selected, setSelected] = useState<FrameworkId[]>(initial);
  const [message, setMessage] = useState("");

  // The static HTML always shows `initial`; read the real selection after hydration
  // and again on back/forward.
  useEffect(() => {
    const known = frameworks.map((f) => f.id);
    const sync = () => {
      const parsed = parseSelection(window.location.search, known, initial);
      setSelected(parsed.ids);
      setMessage(parsed.note);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const commit = (ids: FrameworkId[]) => {
    setSelected(ids);
    setMessage("");
    const url = new URL(window.location.href);
    // Written by hand so the commas stay readable (URLSearchParams would encode them).
    url.search = `?f=${ids.join(",")}`;
    window.history.pushState(null, "", url);
  };

  const toggle = (fw: CompareFramework) => {
    if (selected.includes(fw.id)) {
      if (selected.length <= MIN_PICK) {
        setMessage(
          `A comparison needs at least ${MIN_PICK} frameworks. Add another one before removing ${fw.name}.`,
        );
        return;
      }
      commit(selected.filter((id) => id !== fw.id));
    } else {
      if (selected.length >= MAX_PICK) {
        setMessage(`You can compare at most ${MAX_PICK} frameworks. Remove one before adding ${fw.name}.`);
        return;
      }
      commit([...selected, fw.id]);
    }
  };

  const byId = new Map(frameworks.map((f) => [f.id, f]));
  const picked = selected.map((id) => byId.get(id)).filter((f): f is CompareFramework => !!f);
  const labelOf = (fw: CompareFramework, featureIndex: number): Label => LABEL_CODES[fw.labels[featureIndex]];

  const rows = features.map((feature, i) => ({ feature, labels: picked.map((fw) => labelOf(fw, i)) }));
  const differing = rows.filter((r) => new Set(r.labels).size > 1);
  const same = rows.filter((r) => new Set(r.labels).size === 1);
  const names = listNames(picked.map((f) => f.name));
  const isDefault = selected.join() === initial.join();
  // Most points a feature can earn (a 1st-party label), times the features in each group.
  const fcpMax = features.filter((f) => f.group === "fcp").length * LABELS["first-party"].points;
  const otherMax = features.filter((f) => f.group === "other").length * LABELS["first-party"].points;

  return (
    <>
      <Section
        id="pick"
        index="01"
        title="Pick frameworks"
        intro={`Choose ${MIN_PICK} to ${MAX_PICK}. Your picks are saved in the URL, so you can share or bookmark the comparison.`}
      >
        <div role="group" aria-labelledby="pick-title" aria-describedby="pick-status" class="flex flex-wrap gap-2">
          {frameworks.map((fw) => {
            const on = selected.includes(fw.id);
            return (
              <button
                key={fw.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(fw)}
                class={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-1 text-sm whitespace-nowrap ${
                  on ? "border-ink bg-ink text-paper" : "border-rule-strong bg-surface text-ink hover:border-ink"
                }`}
              >
                <span aria-hidden="true" class="num w-3 text-center">
                  {on ? "✓" : "+"}
                </span>
                <span class="font-semibold">{fw.name}</span>
                <span class={`num text-xs ${on ? "" : "text-ink-3"}`}>{fw.total}/24</span>
              </button>
            );
          })}
        </div>
        <div class="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <p id="pick-status" role="status" aria-live="polite" class="text-ink-2">
            <span class="num">
              {picked.length} of {MAX_PICK}
            </span>{" "}
            selected: {names}.
            {message && <strong class="mt-1 block font-semibold text-ink">{message}</strong>}
          </p>
          {!isDefault && (
            <button type="button" class="link cursor-pointer" onClick={() => commit(initial)}>
              Reset to the top three
            </button>
          )}
        </div>
      </Section>

      <Section
        id="scores"
        index="02"
        title="Scores"
        intro={`Points for documented capability: up to ${fcpMax} from the first-paint levers and ${otherMax} from the other features. A higher score does not mean a faster site.`}
      >
        <ul class={`grid gap-3 ${COLS[picked.length] ?? COLS[4]}`}>
          {picked.map((fw) => (
            <Card
              key={fw.id}
              as="li"
              title={
                <a href={frameworkHref(fw.id)} class="link">
                  {fw.name}
                </a>
              }
              aside={<RankBadge rank={fw.rank} tied={fw.tied} size="sm" />}
            >
              <ScoreBar fcp={fw.fcpScore} other={fw.otherScore} size="sm" />
              <dl class="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                <dt class="text-ink-2">First-paint levers</dt>
                <dd class="num text-right">
                  {fw.fcpScore}
                  <span class="text-ink-3">/10</span>
                </dd>
                <dt class="text-ink-2">Other features</dt>
                <dd class="num text-right">
                  {fw.otherScore}
                  <span class="text-ink-3">/14</span>
                </dd>
                <dt class="text-ink-2">Completeness</dt>
                <dd class="num text-right">{fw.completeness}%</dd>
                <dt class="text-ink-2">Group</dt>
                <dd class="text-right">
                  <Tag tone={fw.group === "core" ? "outline" : "quiet"}>{fw.group}</Tag>
                </dd>
              </dl>
            </Card>
          ))}
        </ul>
      </Section>

      <Section
        id="matrix"
        index="03"
        title="Capability matrix"
        intro="The full matrix, showing only the frameworks you picked. Each cell links to the steps for enabling that feature in that framework."
        actions={<LabelLegend />}
      >
        <CompareMatrix
          frameworks={picked}
          features={features}
          labelOf={labelOf}
          label={`Capability matrix for ${names}`}
          class="max-w-3xl"
        />
      </Section>

      <Section
        id="differences"
        index="04"
        title="Where they differ"
        intro={
          differing.length
            ? `${differing.length} of ${features.length} features have different labels across ${names}.`
            : `${names} have the same label for all ${features.length} features.`
        }
      >
        {differing.length > 0 && (
          <ul class="grid gap-3 lg:grid-cols-2">
            {differing.map(({ feature, labels }) => (
              <Card
                key={feature.id}
                as="li"
                title={
                  <a href={featureHref(feature.id)} class="link">
                    <FeatureName feature={feature} link={false} />
                  </a>
                }
                aside={<Tag tone="quiet">{feature.group === "fcp" ? "first-paint lever" : "other feature"}</Tag>}
              >
                <p class="text-sm text-ink-2 text-pretty">{feature.summary}</p>
                <ul class="mt-3 border-t border-rule">
                  {picked.map((fw, i) => (
                    <li key={fw.id} class="border-b border-rule last:border-b-0">
                      <a
                        href={featureHref(feature.id, fw.id)}
                        class="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
                        aria-label={`${fw.name}, ${feature.shortName}: how to enable it`}
                      >
                        <span class="font-semibold text-ink underline-offset-4 decoration-1 group-hover:underline">
                          {fw.name}
                        </span>
                        <LabelBadge label={labels[i]} />
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </ul>
        )}
        {same.length > 0 && (
          <div class={differing.length ? "mt-7" : ""}>
            <h3 class="eyebrow mb-2 !text-ink-2">
              Same label for all {picked.length} · {same.length} {same.length === 1 ? "feature" : "features"}
            </h3>
            <ul class="flex flex-wrap gap-2">
              {same.map(({ feature, labels }) => (
                <li key={feature.id}>
                  <a href={featureHref(feature.id)} class="inline-flex rounded-sm hover:[&>span]:border-ink">
                    <FeatureChip feature={feature} label={labels[0]} link={false} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  );
}
