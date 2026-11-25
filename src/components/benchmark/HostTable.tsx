import { ExternalLink } from "../links.tsx";
import { Matrix, MatrixColHeader, MatrixGroupRow, MatrixHead } from "../Matrix.tsx";
import { MarkerKey } from "../measured/LaneChart.tsx";
import { hostName } from "./format.ts";
import { MetricValue } from "./parts.tsx";
import type { BenchMetrics } from "../../data/types.ts";

/* --------------------------------------------------------------------------
   Every target of a run (framework × build × host × path) with its medians,
   how many runs went into the median, and any error or cold flag.
   -------------------------------------------------------------------------- */

export interface HostTableRow {
  key: string;
  build: string;
  branch: string;
  path: string;
  host: string;
  url: string;
  median: BenchMetrics | null;
  runs: number;
  usedRuns: number;
  coldSuspect: boolean;
  error: string | null;
}

export interface HostTableGroup {
  key: string;
  name: string;
  rows: HostTableRow[];
}

const SERIES: Record<string, 1 | 2 | 3 | undefined> = { vercel: 1, netlify: 2, cloudflare: 3 };
const METRICS = ["perf", "fcp", "lcp", "tbt", "cls", "si", "doc"] as const;
const HEADS: Record<(typeof METRICS)[number], [string, string]> = {
  perf: ["Perf", "Lighthouse Performance score, 0–100"],
  fcp: ["FCP", "First Contentful Paint, seconds"],
  lcp: ["LCP", "Largest Contentful Paint, seconds"],
  tbt: ["TBT", "Total Blocking Time, milliseconds"],
  cls: ["CLS", "Cumulative Layout Shift"],
  si: ["SI", "Speed Index, seconds"],
  doc: ["Doc", "Document request time as seen by Lighthouse, milliseconds"],
};

function Status({ r, coldMs }: { r: HostTableRow; coldMs: number }) {
  if (r.error) {
    return (
      <span class="block max-w-[18rem] truncate text-xs text-ink" title={r.error}>
        <span class="font-semibold">Error:</span> {r.error}
      </span>
    );
  }
  if (!r.median) return <span class="text-xs text-ink-3">No data</span>;
  if (r.coldSuspect) {
    return (
      <span
        class="num inline-flex items-center rounded-xs border border-ink px-1.5 text-2xs leading-[1.125rem] text-ink"
        title={`Every run's document took over ${coldMs} ms, so the median includes cold runs.`}
      >
        cold suspect
      </span>
    );
  }
  const excluded = r.runs - r.usedRuns;
  if (excluded > 0) {
    return (
      <span class="text-xs text-ink-2" title={`Runs whose document took over ${coldMs} ms were left out of the median.`}>
        {excluded} cold {excluded === 1 ? "run" : "runs"} left out
      </span>
    );
  }
  return <span class="text-xs text-ink-3">OK</span>;
}

export function HostTable({ groups, coldMs = 1000 }: { groups: HostTableGroup[]; coldMs?: number }) {
  const span = 3 + METRICS.length + 1;
  return (
    <Matrix label="Every target in the run: medians per framework, build, path and host">
      <MatrixHead corner="Build">
        <MatrixColHeader>Path</MatrixColHeader>
        <MatrixColHeader>Host</MatrixColHeader>
        {METRICS.map((m) => (
          <MatrixColHeader key={m} title={HEADS[m][1]}>
            <span class="ml-auto">{HEADS[m][0]}</span>
          </MatrixColHeader>
        ))}
        <MatrixColHeader title="Runs that went into the median, of runs made">Runs</MatrixColHeader>
        <MatrixColHeader>Status</MatrixColHeader>
      </MatrixHead>
      {groups.map((g) => (
        <tbody key={g.key}>
          <MatrixGroupRow span={span}>{g.name}</MatrixGroupRow>
          {g.rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" class="mx-rowhead">
                <span>
                  <span class="num text-xs text-ink-2" title={`Branch: ${r.branch}`}>
                    {r.build}
                  </span>
                </span>
              </th>
              <td class="mx-cell !text-left">
                <span class="num text-xs text-ink-2">{r.path}</span>
              </td>
              <td class="mx-cell !text-left">
                <span class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
                  {SERIES[r.host] && <MarkerKey series={SERIES[r.host]!} />}
                  <ExternalLink href={r.url} bare>
                    {hostName(r.host)}
                  </ExternalLink>
                </span>
              </td>
              {METRICS.map((m) => (
                <td key={m} class="mx-cell !text-right">
                  <MetricValue metric={m} value={r.median?.[m]} unit={false} />
                </td>
              ))}
              <td class="mx-cell !text-right">
                <span class="num text-xs text-ink-2">
                  {r.usedRuns}/{r.runs}
                </span>
              </td>
              <td class="mx-cell !text-left">
                <Status r={r} coldMs={coldMs} />
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </Matrix>
  );
}
