import type { Feature, Framework, FrameworkId, Label } from "../../data/types.ts";
import type { HostTableRow } from "../benchmark/HostTable.tsx";

/** Bounds of the compare selection. */
export const MIN_PICK = 2;
export const MAX_PICK = 4;

/** One character per cell keeps the island's props small: 15 × 12 labels in 180 characters. */
export const LABEL_CODES: Record<string, Label> = {
  f: "first-party",
  e: "experimental",
  t: "third-party",
  m: "manual",
};

export function encodeLabel(label: Label): string {
  return label[0];
}

/** What the compare island needs of a framework. `labels[i]` is the code for `features[i]`. */
export type CompareFramework = Pick<
  Framework,
  "id" | "name" | "shortName" | "group" | "fcpScore" | "otherScore" | "total" | "completeness" | "rank"
> & { tied: boolean; labels: string };

/** Latest benchmark medians for the book list page, per framework, build and host. */
export interface CompareBench {
  date: string;
  dateText: string;
  path: string;
  runsPerTarget: number;
  rows: Partial<Record<FrameworkId, HostTableRow[]>>;
}

export type CompareFeature = Pick<Feature, "id" | "number" | "name" | "shortName" | "group" | "summary">;

/**
 * Read `?f=a,b,c` into a valid selection. Unknown ids and repeats are dropped and
 * anything past the fourth is cut; with fewer than two valid ids left the
 * fallback is used. `note` says what was changed, or is "" when nothing was.
 */
export function parseSelection(
  search: string,
  known: FrameworkId[],
  fallback: FrameworkId[],
): { ids: FrameworkId[]; note: string } {
  const raw = new URLSearchParams(search).get("f");
  if (raw === null) return { ids: fallback, note: "" };

  const asked = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unknown = [...new Set(asked.filter((id) => !known.includes(id as FrameworkId)))];
  const valid = [...new Set(asked.filter((id): id is FrameworkId => known.includes(id as FrameworkId)))];

  if (valid.length < MIN_PICK) {
    return {
      ids: fallback,
      note: `The URL did not name at least ${MIN_PICK} known frameworks, so this is the default comparison.`,
    };
  }
  const notes: string[] = [];
  if (unknown.length) notes.push(`Ignored unknown framework ${unknown.length === 1 ? "id" : "ids"} in the URL: ${unknown.join(", ")}.`);
  if (valid.length > MAX_PICK) notes.push(`The URL named ${valid.length} frameworks. Showing the first ${MAX_PICK}.`);
  return { ids: valid.slice(0, MAX_PICK), note: notes.join(" ") };
}
