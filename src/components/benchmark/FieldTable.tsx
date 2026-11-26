import { ExternalLink } from "../links.tsx";
import { Matrix, MatrixColHeader, MatrixGroupRow, MatrixHead } from "../Matrix.tsx";
import { hostName } from "./format.ts";
import { MetricValue } from "./parts.tsx";
import type { BenchField } from "../../data/types.ts";

/* --------------------------------------------------------------------------
   CrUX field data: the 75th percentile of real Chrome visits, one row per
   target that PageSpeed Insights returned page-level data for.
   -------------------------------------------------------------------------- */

export interface FieldTableRow {
  key: string;
  build: string;
  branch: string;
  path: string;
  host: string;
  url: string;
  field: BenchField;
}

export interface FieldTableGroup {
  key: string;
  name: string;
  rows: FieldTableRow[];
}

const COLS: { key: keyof BenchField; label: string; title: string }[] = [
  { key: "lcp", label: "LCP", title: "Largest Contentful Paint, p75, seconds" },
  { key: "inp", label: "INP", title: "Interaction to Next Paint, p75, milliseconds" },
  { key: "cls", label: "CLS", title: "Cumulative Layout Shift, p75" },
  { key: "fcp", label: "FCP", title: "First Contentful Paint, p75, seconds" },
  { key: "ttfb", label: "TTFB", title: "Time to First Byte, p75, milliseconds" },
];

export function FieldTable({ groups, showPath = true }: { groups: FieldTableGroup[]; showPath?: boolean }) {
  const span = (showPath ? 2 : 1) + COLS.length;
  return (
    <Matrix label="Chrome UX Report field data, 75th percentile, per framework, build, path and host">
      <MatrixHead corner="Build">
        {showPath && <MatrixColHeader>Path</MatrixColHeader>}
        <MatrixColHeader>Host</MatrixColHeader>
        {COLS.map((c) => (
          <MatrixColHeader key={c.key} title={c.title}>
            <span class="ml-auto">{c.label}</span>
          </MatrixColHeader>
        ))}
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
              {showPath && (
                <td class="mx-cell !text-left">
                  <span class="num text-xs text-ink-2">{r.path}</span>
                </td>
              )}
              <td class="mx-cell !text-left">
                <span class="whitespace-nowrap text-xs">
                  <ExternalLink href={r.url} bare>
                    {hostName(r.host)}
                  </ExternalLink>
                </span>
              </td>
              {COLS.map((c) => (
                <td key={c.key} class="mx-cell !text-right">
                  <MetricValue metric={c.key} value={r.field[c.key]} unit={false} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      ))}
    </Matrix>
  );
}
