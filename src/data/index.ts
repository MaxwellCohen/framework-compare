/**
 * Typed accessors over the generated JSON. Import from here, not from
 * `./generated/*` directly. Only import this module from loaders
 * (`loader`, `getStaticPaths`) so the full dataset never ships to the client:
 * a loader should return just the slice its page renders.
 */
import capabilityJson from "./generated/capability.json";
import measuredJson from "./generated/measured.json";
import type {
  CapabilityData,
  Cell,
  Feature,
  FeatureGroup,
  FeatureId,
  Framework,
  FrameworkId,
  Label,
  MeasuredData,
  Points,
} from "./types.ts";

export type * from "./types.ts";

export const capability = capabilityJson as unknown as CapabilityData;
export const measured = measuredJson as unknown as MeasuredData;

export const frameworks: Framework[] = capability.frameworks;
export const features: Feature[] = capability.features;
export const cells: Cell[] = capability.cells;
export const ranking = capability.ranking;

export const MAX_SCORE: Record<FeatureGroup, number> = { fcp: 10, other: 14 };
export const MAX_TOTAL = 24;

export const LABEL_POINTS: Record<Label, Points> = {
  "first-party": 2,
  experimental: 1,
  "third-party": 1,
  manual: 0,
};

/** Human label text, matching the source wording. */
export const LABEL_TEXT: Record<Label, string> = {
  "first-party": "1st-party",
  experimental: "Experimental",
  "third-party": "Third-party",
  manual: "Manual",
};

const frameworkById = new Map(frameworks.map((f) => [f.id, f]));
const featureById = new Map(features.map((f) => [f.id, f]));
const cellByKey = new Map(cells.map((c) => [`${c.frameworkId}:${c.featureId}`, c]));

export function getFramework(id: string): Framework | undefined {
  return frameworkById.get(id as FrameworkId);
}

export function getFeature(id: string): Feature | undefined {
  return featureById.get(id as FeatureId);
}

export function getCell(frameworkId: FrameworkId, featureId: FeatureId): Cell {
  const cell = cellByKey.get(`${frameworkId}:${featureId}`);
  if (!cell) throw new Error(`Missing cell ${frameworkId}:${featureId}`);
  return cell;
}

export function featuresInGroup(group: FeatureGroup): Feature[] {
  return features.filter((f) => f.group === group);
}

/** Frameworks sorted by rank, ties in source column order. */
export function frameworksByRank(): Framework[] {
  return [...frameworks].sort((a, b) => a.rank - b.rank || a.order - b.order);
}

/** The compact matrix: label + points per cell, without the HTML bodies. */
export interface MatrixCell {
  label: Label;
  points: Points;
}
export type Matrix = Record<FrameworkId, Record<FeatureId, MatrixCell>>;

export function getMatrix(): Matrix {
  const matrix = {} as Matrix;
  for (const cell of cells) {
    (matrix[cell.frameworkId] ??= {} as Record<FeatureId, MatrixCell>)[cell.featureId] = {
      label: cell.label,
      points: cell.points,
    };
  }
  return matrix;
}
