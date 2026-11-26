import type { IslandProps } from "@pracht/core";
import { useState } from "preact/hooks";
import {
  BuildTable,
  COLUMN_SETS,
  sortRows,
  type BuildTableRow,
  type ColumnSet,
  type SortKey,
  type SortState,
} from "../components/benchmark/BuildTable.tsx";

interface BenchTableProps {
  rows: BuildTableRow[];
  paths: string[];
  hostCount: number;
  label: string;
  initial: SortState;
}

const SETS = Object.keys(COLUMN_SETS) as ColumnSet[];

/**
 * The /benchmark builds table with sortable columns and a column-set toggle.
 * The server render (and the no-JS page) shows `initial` with every column;
 * after hydration each header sorts within each path group, and the toggle
 * narrows the table to fewer metrics for small screens.
 */
export default function BenchTable({ rows, paths, hostCount, label, initial }: BenchTableProps & IslandProps) {
  const [sort, setSort] = useState<SortState>(initial);
  const [set, setSet] = useState<ColumnSet>("all");
  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : // Lower is better for times, TBT and CLS; higher for the score and host count.
          { key, dir: key === "perf" || key === "hosts" ? "desc" : "asc" },
    );
  return (
    <>
      <div role="group" aria-label="Columns to show" class="mb-3 flex flex-wrap items-center gap-2">
        <span class="eyebrow mr-1">Columns</span>
        {SETS.map((k) => {
          const on = set === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => setSet(k)}
              class={`inline-flex min-h-9 cursor-pointer items-center rounded-sm border px-2.5 py-1 text-sm whitespace-nowrap ${
                on ? "border-ink bg-ink text-paper" : "border-rule-strong bg-surface text-ink hover:border-ink"
              }`}
            >
              {COLUMN_SETS[k].label}
            </button>
          );
        })}
      </div>
      <BuildTable
        rows={sortRows(rows, sort)}
        paths={paths}
        hostCount={hostCount}
        metrics={COLUMN_SETS[set].metrics}
        label={label}
        sort={sort}
        onSort={onSort}
      />
    </>
  );
}
