import type { CellTest } from "../../data/types.ts";
import { LABELS } from "../LabelBadge.tsx";
import { ExternalLink, NavLink } from "../links.tsx";

const STATUS_TEXT: Record<CellTest["status"], string> = {
  pass: "passed",
  fail: "failed",
  "n/a": "not applicable",
};
const STATUS_GLYPH: Record<CellTest["status"], string> = { pass: "✓", fail: "✗", "n/a": "–" };

/** "Tested in our port: passed", in ink (tier colours are for labels only). */
export function TestStatus({ test, class: cls = "" }: { test: Pick<CellTest, "status">; class?: string }) {
  return (
    <span class={`inline-flex items-center gap-1.5 text-sm ${cls}`}>
      <span
        aria-hidden="true"
        class={`num inline-grid size-4 place-items-center rounded-sm border text-[0.7rem] leading-none ${
          test.status === "fail" ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink"
        }`}
      >
        {STATUS_GLYPH[test.status]}
      </span>
      <span class="text-ink-2">
        Tested in our port: <span class="font-semibold text-ink">{STATUS_TEXT[test.status]}</span>
      </span>
    </span>
  );
}

/**
 * Our own test of one framework × feature cell: status, what the test saw, and
 * links to the spec and the port's feature-tests folder at the tested commit.
 */
export function TestResult({ test, class: cls = "" }: { test: CellTest; class?: string }) {
  return (
    <aside class={`max-w-prose border-l-2 border-rule-strong pl-3 ${cls}`} aria-label="Our feature test">
      <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TestStatus test={test} />
        <span class="text-xs text-ink-3">
          {test.specUrl && (
            <>
              <ExternalLink href={test.specUrl}>Test</ExternalLink>
              {" · "}
            </>
          )}
          <ExternalLink href={test.testsUrl}>
            <span class="num">
              {test.repo.split("/")[1]}@{test.shortCommit}
            </span>
          </ExternalLink>
          {" · "}
          <NavLink to={{ route: "methodology", hash: "feature-tests" }} class="link">
            How we test
          </NavLink>
        </span>
      </p>
      {test.method && (
        <p class="mt-1.5 text-xs text-ink-2">
          Port setup: {test.method}
          {test.testRoute && (
            <>
              {" "}
              (route <code class="font-mono">{test.testRoute}</code>)
            </>
          )}
        </p>
      )}
      <p class="mt-1 text-xs break-words text-ink-2">Result: {test.evidence}</p>
      {test.testedAs && (
        <p class="mt-1 text-xs text-ink-3">
          The test was written for the earlier {LABELS[test.testedAs].text} label, so it checks that route.
        </p>
      )}
    </aside>
  );
}
