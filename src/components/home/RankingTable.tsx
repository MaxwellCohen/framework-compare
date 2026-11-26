import type { FeatureGroup, Framework } from "../../data/types.ts";
import { Matrix, MatrixCell, MatrixColHeader, MatrixHead, MatrixRow, MatrixRowHeader } from "../Matrix.tsx";
import { RankBadge, ScoreBar } from "../Score.tsx";

export type RankingFramework = Pick<
  Framework,
  "id" | "name" | "group" | "fcpScore" | "otherScore" | "total" | "completeness" | "rank"
> & { tied: boolean };

/**
 * All frameworks in rank order: rank, name (links to the framework page), the
 * split score bar, the three point columns, and completeness.
 * Pass the rows already sorted.
 */
export function RankingTable({
  frameworks,
  max,
}: {
  frameworks: RankingFramework[];
  /** Points available per group: 2 per feature. */
  max: Record<FeatureGroup, number>;
}) {
  const maxTotal = max.fcp + max.other;
  return (
    <Matrix label="Frameworks ranked by total score" class="ranking">
      <MatrixHead corner="Framework">
        <MatrixColHeader>Score</MatrixColHeader>
        <MatrixColHeader title={`Points from the ${max.fcp / 2} first-paint levers, out of ${max.fcp}`}>First paint</MatrixColHeader>
        <MatrixColHeader title={`Points from the ${max.other / 2} other features, out of ${max.other}`}>Other</MatrixColHeader>
        <MatrixColHeader>Total</MatrixColHeader>
        <MatrixColHeader title={`Total as a share of the ${maxTotal} available points`}>Complete</MatrixColHeader>
      </MatrixHead>
      <tbody>
        {frameworks.map((f) => (
          <MatrixRow key={f.id}>
            <MatrixRowHeader to={{ route: "framework", id: f.id }}>
              <RankBadge rank={f.rank} tied={f.tied} size="sm" />
              <span class="font-semibold">{f.name}</span>
            </MatrixRowHeader>
            <MatrixCell class="text-left">
              <ScoreBar fcp={f.fcpScore} other={f.otherScore} fcpMax={max.fcp} otherMax={max.other} size="sm" showValue={false} />
            </MatrixCell>
            <MatrixCell>
              <span class="num whitespace-nowrap">
                {f.fcpScore}
                <span class="text-ink-3">/{max.fcp}</span>
              </span>
            </MatrixCell>
            <MatrixCell>
              <span class="num whitespace-nowrap">
                {f.otherScore}
                <span class="text-ink-3">/{max.other}</span>
              </span>
            </MatrixCell>
            <MatrixCell>
              <span class="num whitespace-nowrap font-semibold text-ink">
                {f.total}
                <span class="font-normal text-ink-3">/{maxTotal}</span>
              </span>
            </MatrixCell>
            <MatrixCell>
              <span class="num">{f.completeness}%</span>
            </MatrixCell>
          </MatrixRow>
        ))}
      </tbody>
    </Matrix>
  );
}
