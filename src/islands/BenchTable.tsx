import type { IslandProps } from "@pracht/core";
import { useState } from "preact/hooks";
import { BuildTable, sortRows, type BuildTableRow, type SortKey, type SortState } from "../components/benchmark/BuildTable.tsx";

interface BenchTableProps {
  rows: BuildTableRow[];
  paths: string[];
  hostCount: number;
  label: string;
  initial: SortState;
}

/**
 * The /benchmark builds table with sortable columns. The server render (and the
 * no-JS page) shows `initial`; after hydration each header sorts within each
 * path group. Clicking the active column flips the direction.
 */
export default function BenchTable({ rows, paths, hostCount, label, initial }: BenchTableProps & IslandProps) {
  const [sort, setSort] = useState<SortState>(initial);
  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : // Lower is better for times, TBT and CLS; higher for the score and host count.
          { key, dir: key === "perf" || key === "hosts" ? "desc" : "asc" },
    );
  return <BuildTable rows={sortRows(rows, sort)} paths={paths} hostCount={hostCount} label={label} sort={sort} onSort={onSort} />;
}
