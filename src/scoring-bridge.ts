/**
 * Scoring Bridge — standalone scoring that bypasses the DB-dependent registry.
 *
 * The parent project's `registry.ts` imports `@/lib/db` (better-sqlite3),
 * which requires the full Next.js app context. This bridge imports the
 * version definitions and scoring categories directly, then re-implements
 * the scoring orchestration without any DB dependency.
 */

import type {
  ListingPayload,
  ScoreResult,
  CategoryResult,
  ScoreBreakdown,
  ScoringVersionDef,
} from "../../src/lib/scoring/types";

// Import individual category scorers directly (no DB dependency)
import { titleSeoScorer } from "../../src/lib/scoring/categories/title-seo";
import { tagSeoScorer } from "../../src/lib/scoring/categories/tag-seo";
import { photosVisualScorer } from "../../src/lib/scoring/categories/photos-visual";
import { descriptionScorer } from "../../src/lib/scoring/categories/description";
import { conversionOfferScorer } from "../../src/lib/scoring/categories/conversion-offer";
import { scoreEngagement } from "../../src/lib/scoring/categories/engagement";
import { round2 } from "../../src/lib/scoring/categories/helpers";

// Build the version definition inline (same as v2.0.0.ts but without import chain)
const VERSION_DEF: ScoringVersionDef = {
  version: "2.0.0",
  name: "Dylan Jahraus Course Alignment v2",
  description:
    "Course-derived rubric with 5 quality categories, separated engagement tracking, and rich issue diagnostics.",
  changelog: "MCP server standalone build",
  gradeThresholds: { A: 90, B: 80, C: 70, D: 60 },
  categories: [
    titleSeoScorer,
    tagSeoScorer,
    photosVisualScorer,
    descriptionScorer,
    conversionOfferScorer,
  ],
  engagementScorer: scoreEngagement,
};

/**
 * Score a listing using the v2 scoring engine — no DB required.
 */
export function scoreListing(payload: ListingPayload): ScoreResult {
  const versionDef = VERSION_DEF;

  const categories: CategoryResult[] = versionDef.categories.map((scorer) =>
    scorer.score(payload),
  );

  const total_score = round2(
    categories.reduce((sum, cat) => sum + cat.points, 0),
  );

  const { A, B, C, D } = versionDef.gradeThresholds;
  const grade: ScoreResult["grade"] =
    total_score >= A
      ? "A"
      : total_score >= B
        ? "B"
        : total_score >= C
          ? "C"
          : total_score >= D
            ? "D"
            : "F";

  const all_issues = categories.flatMap((cat) => cat.issues);

  const breakdown: ScoreBreakdown = {};
  for (const cat of categories) {
    breakdown[cat.key] = {
      points: cat.points,
      max: cat.maxPoints,
      subMetrics: cat.subMetrics,
    };
  }

  const engagement = versionDef.engagementScorer(payload);

  return {
    total_score,
    total_score_display: total_score.toFixed(2),
    grade,
    scoring_version: versionDef.version,
    breakdown,
    categories,
    all_issues,
    engagement,
  };
}

/**
 * Get the version definition metadata (for the methodology resource).
 */
export function getVersionInfo() {
  return {
    version: VERSION_DEF.version,
    name: VERSION_DEF.name,
    description: VERSION_DEF.description,
    gradeThresholds: VERSION_DEF.gradeThresholds,
    categories: VERSION_DEF.categories.map((c) => ({
      key: c.key,
      name: c.name,
      maxPoints: c.maxPoints,
      subMetrics: c.subMetricDefs,
    })),
    totalMaxPoints: VERSION_DEF.categories.reduce(
      (sum, c) => sum + c.maxPoints,
      0,
    ),
  };
}

// Re-export types for convenience
export type { ListingPayload, ScoreResult } from "../../src/lib/scoring/types";
