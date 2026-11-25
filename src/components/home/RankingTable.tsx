import type { Framework } from "../../data/types.ts";
import { Matrix, MatrixCell, MatrixColHeader, MatrixHead, MatrixRow, MatrixRowHeader } from "../Matrix.tsx";
import { Tag } from "../Page.tsx";
import { RankBadge, ScoreBar } from "../Score.tsx";

export type RankingFramework = Pick<
  Framework,
  "id" | "name" | "group" | "fcpScore" | "otherScore" | "total" | "completeness" | "rank"
> & { tied: boolean };

/**
 * All frameworks in rank order: rank, name (links to the framework page), the
 * split score bar, the three point columns, completeness, and the group.
 * Pass the rows already sorted.
 */
export function RankingTable({ frameworks, maxTotal }: { frameworks: RankingFramework[]; maxTotal: number }) {
  return (
    <Matrix label="Frameworks ranked by total score" class="ranking">
      <MatrixHead corner="Framework">
        <MatrixColHeader>Score</MatrixColHeader>
        <MatrixColHeader title="Points from the five first-paint levers, out of 10">First paint</MatrixColHeader>
        <MatrixColHeader title="Points from the seven other features, out of 14">Other</MatrixColHeader>
        <MatrixColHeader>Total</MatrixColHeader>
        <MatrixColHeader title="Total as a share of the 24 available points">Complete</MatrixColHeader>
        <MatrixColHeader title="Core: full how-to sections. Additional: scored from documentation notes.">
          Group
        </MatrixColHeader>
      </MatrixHead>
      <tbody>
        {frameworks.map((f) => (
          <MatrixRow key={f.id}>
            <MatrixRowHeader to={{ route: "framework", id: f.id }}>
              <RankBadge rank={f.rank} tied={f.tied} size="sm" />
              <span class="font-semibold">{f.name}</span>
            </MatrixRowHeader>
            <MatrixCell class="text-left">
              <ScoreBar fcp={f.fcpScore} other={f.otherScore} size="sm" showValue={false} />
            </MatrixCell>
            <MatrixCell>
              <span class="num whitespace-nowrap">
                {f.fcpScore}
                <span class="text-ink-3">/10</span>
              </span>
            </MatrixCell>
            <MatrixCell>
              <span class="num whitespace-nowrap">
                {f.otherScore}
                <span class="text-ink-3">/14</span>
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
            <MatrixCell>
              <Tag tone={f.group === "core" ? "outline" : "quiet"}>{f.group}</Tag>
            </MatrixCell>
          </MatrixRow>
        ))}
      </tbody>
    </Matrix>
  );
}
