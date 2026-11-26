import { hostName, pathName, type BenchMetricKey } from "./format.ts";
import { MetricValue } from "./parts.tsx";

/* --------------------------------------------------------------------------
   Builds table: one row per framework × build × path, averaged across hosts.
   Presentational and island-safe (plain <a href>, no NavLink, no data
   imports). The /benchmark page renders it through the BenchTable island,
   which adds sorting; framework pages render it directly, without sorting.
   Uses the `.mx` table styles from global.css.
   -------------------------------------------------------------------------- */

export interface BuildTableRow {
  key: string;
  frameworkId: string;
  framework: string;
  /** Framework page URL (from the typed `href()`), or null for no link. */
  href: string | null;
  /** "baseline", "optimized", "max optimized". */
  build: string;
  branch: string;
  /** Sort key for builds within a framework. */
  buildRank: number;
  path: string;
  perf: number | null;
  fcp: number | null;
  lcp: number | null;
  tbt: number | null;
  cls: number | null;
  si: number | null;
  tti: number | null;
  doc: number | null;
  /** Hosts that went into the average. */
  hosts: string[];
}

type LabMetric = Extract<BenchMetricKey, "perf" | "fcp" | "lcp" | "tbt" | "cls" | "si" | "tti" | "doc">;
export type SortKey = "framework" | LabMetric | "hosts";
export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const METRIC_COLS: { key: LabMetric; label: string; title: string }[] = [
  { key: "perf", label: "Perf", title: "Lighthouse Performance score, 0–100, higher is better" },
  { key: "fcp", label: "FCP", title: "First Contentful Paint, seconds" },
  { key: "lcp", label: "LCP", title: "Largest Contentful Paint, seconds" },
  { key: "tbt", label: "TBT", title: "Total Blocking Time, milliseconds" },
  { key: "cls", label: "CLS", title: "Cumulative Layout Shift" },
  { key: "si", label: "SI", title: "Speed Index, seconds" },
  { key: "tti", label: "TTI", title: "Time to Interactive, seconds" },
  { key: "doc", label: "Doc", title: "Document request time (about TTFB), milliseconds" },
];

/** Column sets for the /benchmark toggle. Every set keeps the score. */
export const COLUMN_SETS = {
  all: { label: "All", metrics: METRIC_COLS.map((c) => c.key) },
  vitals: { label: "Paint and layout", metrics: ["perf", "fcp", "lcp", "cls"] },
  timing: { label: "Load and script", metrics: ["perf", "tbt", "si", "tti", "doc"] },
} satisfies Record<string, { label: string; metrics: LabMetric[] }>;
export type ColumnSet = keyof typeof COLUMN_SETS;

/** Sort rows; missing values always go last, ties fall back to framework then build. */
export function sortRows(rows: BuildTableRow[], { key, dir }: SortState): BuildTableRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const byName = (a: BuildTableRow, b: BuildTableRow) => a.framework.localeCompare(b.framework) || a.buildRank - b.buildRank;
  return [...rows].sort((a, b) => {
    if (key === "framework") return sign * a.framework.localeCompare(b.framework) || a.buildRank - b.buildRank;
    const va = key === "hosts" ? a.hosts.length : a[key];
    const vb = key === "hosts" ? b.hosts.length : b[key];
    if (va == null && vb == null) return byName(a, b);
    if (va == null) return 1;
    if (vb == null) return -1;
    return sign * (va - vb) || byName(a, b);
  });
}

export function BuildTable({
  rows,
  paths,
  hostCount,
  showFramework = true,
  metrics,
  label,
  sort,
  onSort,
}: {
  rows: BuildTableRow[];
  /** Paths in display order; one row group each. */
  paths: string[];
  /** Hosts in the run, for "2 of 3". */
  hostCount: number;
  showFramework?: boolean;
  /** Metric columns to show, in table order. Defaults to all of them. */
  metrics?: LabMetric[];
  label: string;
  /** Current sort, shown with aria-sort. */
  sort?: SortState;
  /** Makes the column headers sort buttons. */
  onSort?: (key: SortKey) => void;
}) {
  const metricCols = metrics ? METRIC_COLS.filter((c) => metrics.includes(c.key)) : METRIC_COLS;
  const cols = 2 + metricCols.length; // path, metrics…, hosts (row header not counted)
  const ariaSort = (key: SortKey) =>
    sort?.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : onSort ? "none" : undefined;

  const head = (key: SortKey, text: string, title: string, right = true) => (
    <th scope="col" class="mx-colhead" title={title} aria-sort={ariaSort(key)}>
      {onSort ? (
        <button
          type="button"
          onClick={() => onSort(key)}
          class={`flex w-full cursor-pointer items-end gap-1 px-2 py-2 hover:text-ink ${right ? "justify-end" : ""}`}
        >
          {text}
          <span aria-hidden="true" class={`num text-2xs ${sort?.key === key ? "text-ink" : "text-ink-3"}`}>
            {sort?.key === key ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </button>
      ) : (
        <span class={`!px-2 ${right ? "justify-end" : ""}`}>{text}</span>
      )}
    </th>
  );

  return (
    <div class="mx-wrap">
      <div class="mx-scroll" tabIndex={0} role="group" aria-label={`${label} (scrollable table)`}>
        <table class="mx">
          <caption class="sr-only">
            {label}
            {onSort && ". Column headers are buttons that sort the rows."}
          </caption>
          <thead>
            <tr>
              {showFramework ? (
                <th scope="col" class="mx-corner" aria-sort={ariaSort("framework")}>
                  {onSort ? (
                    <button type="button" onClick={() => onSort("framework")} class="eyebrow flex cursor-pointer items-center gap-1 hover:text-ink">
                      Framework · build
                      <span aria-hidden="true" class={sort?.key === "framework" ? "text-ink" : ""}>
                        {sort?.key === "framework" ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  ) : (
                    <span class="eyebrow">Framework · build</span>
                  )}
                </th>
              ) : (
                <th scope="col" class="mx-corner">
                  <span class="eyebrow">Build</span>
                </th>
              )}
              <th scope="col" class="mx-colhead">
                <span class="!px-2">Path</span>
              </th>
              {metricCols.map((c) => head(c.key, c.label, c.title))}
              {head("hosts", "Hosts", "Hosts whose medians were averaged", false)}
            </tr>
          </thead>
          {paths.map((path) => {
            const group = rows.filter((r) => r.path === path);
            if (!group.length) return null;
            return (
              <tbody key={path}>
                <tr class="mx-group">
                  <th scope="rowgroup" colSpan={cols + 1} class="eyebrow whitespace-nowrap !text-ink-2">
                    {pathName(path)} <span class="normal-case">{path}</span>
                  </th>
                </tr>
                {group.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" class="mx-rowhead">
                      <span class="whitespace-nowrap">
                        {showFramework &&
                          (r.href ? (
                            <a href={r.href} class="font-semibold hover:underline">
                              {r.framework}
                            </a>
                          ) : (
                            <span class="font-semibold">{r.framework}</span>
                          ))}
                        <span
                          class={`num inline-flex items-center rounded-xs border border-rule-strong px-1.5 text-2xs leading-[1.125rem] text-ink-2 ${showFramework ? "ml-2" : ""}`}
                          title={`Branch: ${r.branch}`}
                        >
                          {r.build}
                        </span>
                      </span>
                    </th>
                    <td class="mx-cell !text-left">
                      <span class="num text-xs text-ink-2">{r.path}</span>
                    </td>
                    {metricCols.map((c) => (
                      <td key={c.key} class="mx-cell !text-right">
                        <MetricValue metric={c.key} value={r[c.key]} unit={false} />
                      </td>
                    ))}
                    <td class="mx-cell !text-left">
                      <span class="whitespace-nowrap text-xs text-ink-2" title={r.hosts.map(hostName).join(", ")}>
                        <span class="num">
                          {r.hosts.length}/{hostCount}
                        </span>{" "}
                        <span class="text-ink-3">{r.hosts.map(hostName).join(", ")}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
