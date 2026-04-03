#!/usr/bin/env node
/**
 * Listing Doctor MCP Server
 *
 * Exposes the Etsy listing optimization scoring engine as MCP tools
 * that AI agents (Claude, GPT, etc.) can use to analyze and improve
 * Etsy listings.
 *
 * Transport: stdio (standard for MCP servers)
 * Protocol: Model Context Protocol (MCP) v1.0
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  scoreListing,
  getVersionInfo,
  type ListingPayload,
  type ScoreResult,
} from "./scoring-bridge";

// ─── Server Setup ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "listing-doctor",
  version: "1.0.0",
  description:
    "Listing Doctor — Etsy listing optimization scoring engine. Analyze titles, tags, descriptions, photos, and more for SEO and conversion optimization.",
});

// ─── Helper: Format Score for LLM Consumption ─────────────────────────────────

function formatScoreResult(result: ScoreResult): object {
  return {
    score: {
      total: result.total_score,
      display: result.total_score_display,
      grade: result.grade,
      maxPossible: 100,
      version: result.scoring_version,
    },
    breakdown: Object.entries(result.breakdown).map(([key, val]) => ({
      category: key,
      points: val.points,
      maxPoints: val.max,
      percentage: Math.round((val.points / val.max) * 100),
    })),
    issues: result.all_issues.map((issue) => ({
      severity: issue.severity,
      category: issue.category,
      message: issue.message,
      detail: issue.detail,
      current: issue.currentValue,
      target: issue.targetValue,
      courseRef: issue.courseRef,
    })),
    issueSummary: {
      critical: result.all_issues.filter((i) => i.severity === "critical")
        .length,
      high: result.all_issues.filter((i) => i.severity === "high").length,
      medium: result.all_issues.filter((i) => i.severity === "medium").length,
      low: result.all_issues.filter((i) => i.severity === "low").length,
    },
    engagement: result.engagement,
  };
}

// ─── Tool 1: score_listing ─────────────────────────────────────────────────────

server.tool(
  "score_listing",
  `Score an Etsy listing for SEO and conversion optimization. Provide the listing's title, tags, description, photo count, and alt texts to get a detailed score with grade (A-F), category breakdown, and specific issues to fix.

Returns a 100-point score across 5 categories:
- Title SEO (28 pts): character usage, long-tail keywords, diversity, front-loading
- Tag SEO (20 pts): slot usage, multi-word tags, cannibalization, title alignment
- Photos & Visual (27 pts): photo count, video, alt text coverage/quality/SEO
- Description (15 pts): SEO opener, mobile-scannable, structured sections, length
- Conversion & Offer (10 pts): pricing, personalization, friction reducers, variations

Grade thresholds: A >= 90, B >= 80, C >= 70, D >= 60, F < 60`,
  {
    title: z
      .string()
      .describe(
        "The Etsy listing title (max 140 characters). This is the primary SEO field.",
      ),
    tags: z
      .array(z.string())
      .describe(
        "Array of listing tags (Etsy allows up to 13 tags, each up to 20 characters).",
      ),
    description: z
      .string()
      .describe(
        "The full listing description text. Used for SEO opener analysis, structure detection, and friction reducer checks.",
      ),
    photos_count: z
      .number()
      .int()
      .min(0)
      .max(10)
      .describe("Number of listing photos (Etsy allows up to 10)."),
    alt_texts: z
      .array(z.string())
      .describe(
        "Array of alt texts for listing images. Empty strings for images without alt text.",
      ),
    favorites: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe("Number of favorites/hearts on the listing."),
    views: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Number of listing views (if known)."),
    has_video: z
      .boolean()
      .optional()
      .describe("Whether the listing has a video."),
    price: z
      .number()
      .min(0)
      .optional()
      .describe("Listing price in dollars (e.g. 24.99)."),
    is_personalizable: z
      .boolean()
      .optional()
      .describe("Whether the listing offers personalization options."),
    variation_count: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Number of variations (size, color, etc.) available."),
    sales: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Total number of sales for this listing."),
  },
  async (params) => {
    try {
      const payload: ListingPayload = {
        title: params.title,
        tags: params.tags,
        description: params.description,
        photos_count: params.photos_count,
        alt_texts: params.alt_texts,
        favorites: params.favorites ?? 0,
        views: params.views,
        has_video: params.has_video,
        price: params.price,
        is_personalizable: params.is_personalizable,
        variation_count: params.variation_count,
        sales: params.sales,
      };

      const result = scoreListing(payload);
      const formatted = formatScoreResult(result);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown scoring error";
      return {
        content: [{ type: "text" as const, text: `Error scoring listing: ${message}` }],
        isError: true,
      };
    }
  },
);

// ─── Tool 2: analyze_listing_url ───────────────────────────────────────────────

server.tool(
  "analyze_listing_url",
  `Analyze an Etsy listing by its URL. Extracts the listing ID, fetches details from the Etsy API, and returns a full optimization score.

NOTE: This tool requires the Etsy API to be configured with valid credentials. If the API is not available, use the 'score_listing' tool instead by manually providing the listing details.

Accepts URLs like:
- https://www.etsy.com/listing/123456789/...
- https://www.etsy.com/listing/123456789`,
  {
    url: z
      .string()
      .url()
      .describe(
        "Etsy listing URL (e.g. https://www.etsy.com/listing/123456789/my-product-title)",
      ),
  },
  async (params) => {
    try {
      // Extract listing ID from URL
      const match = params.url.match(
        /etsy\.com\/listing\/(\d+)/,
      );
      if (!match) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid Etsy listing URL. Expected format: https://www.etsy.com/listing/123456789/...

Could not extract a listing ID from: ${params.url}`,
            },
          ],
          isError: true,
        };
      }

      const listingId = match[1];

      // Check if Etsy API is configured
      const clientId = process.env.ETSY_CLIENT_ID;
      const apiKey = process.env.ETSY_API_KEY ?? clientId;

      if (!apiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Etsy API is not configured. To use this tool, set the ETSY_CLIENT_ID environment variable.

Extracted listing ID: ${listingId}

Alternative: Use the 'score_listing' tool instead by providing the listing details manually:
- Copy the title, tags, description from the Etsy listing page
- Count the photos and note their alt texts
- Pass all details to 'score_listing'

To configure the Etsy API:
1. Get an API key from https://www.etsy.com/developers
2. Set ETSY_CLIENT_ID in your environment
3. Authenticate via the Listing Doctor web app to get OAuth tokens`,
            },
          ],
          isError: true,
        };
      }

      // Attempt to fetch from Etsy API
      // We do a lightweight fetch here to avoid importing the full Etsy client
      // (which also has DB dependencies)
      const accessToken = process.env.ETSY_ACCESS_TOKEN;
      if (!accessToken) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Etsy API key found but no access token available. The Listing Doctor web app handles OAuth authentication.

Extracted listing ID: ${listingId}

To use URL-based analysis:
1. Connect your Etsy shop via the Listing Doctor web app
2. Set ETSY_ACCESS_TOKEN in your environment

Alternative: Use the 'score_listing' tool by providing listing details manually.`,
            },
          ],
          isError: true,
        };
      }

      // Fetch listing data from Etsy API
      const ETSY_API_BASE = "https://openapi.etsy.com/v3";
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": apiKey,
      };

      const [listingRes, imagesRes] = await Promise.all([
        fetch(`${ETSY_API_BASE}/application/listings/${listingId}`, {
          headers,
        }),
        fetch(
          `${ETSY_API_BASE}/application/listings/${listingId}/images`,
          { headers },
        ),
      ]);

      if (!listingRes.ok) {
        const errText = await listingRes.text();
        return {
          content: [
            {
              type: "text" as const,
              text: `Etsy API error fetching listing ${listingId}: ${listingRes.status} ${errText}

The access token may be expired. Re-authenticate via the Listing Doctor web app.

Alternative: Use the 'score_listing' tool by providing listing details manually.`,
            },
          ],
          isError: true,
        };
      }

      const listing = (await listingRes.json()) as {
        listing_id: number;
        title: string;
        description: string;
        tags: string[];
        views: number;
        num_favorers: number;
        price?: { amount?: number; divisor?: number };
        is_personalizable?: boolean;
        has_variations?: boolean;
      };

      let images: Array<{
        alt_text: string | null;
        rank: number;
      }> = [];
      if (imagesRes.ok) {
        const imagesData = (await imagesRes.json()) as {
          results: typeof images;
        };
        images = imagesData.results ?? [];
      }

      // Try to fetch videos
      let hasVideo = false;
      try {
        const videosRes = await fetch(
          `${ETSY_API_BASE}/application/listings/${listingId}/videos`,
          { headers },
        );
        if (videosRes.ok) {
          const videosData = (await videosRes.json()) as {
            results: unknown[];
          };
          hasVideo = (videosData.results?.length ?? 0) > 0;
        }
      } catch {
        // Video fetch failed — not critical
      }

      // Build payload
      const payload: ListingPayload = {
        title: listing.title ?? "",
        tags: listing.tags ?? [],
        description: listing.description ?? "",
        photos_count: images.length,
        alt_texts: images
          .sort((a, b) => a.rank - b.rank)
          .map((img) => img.alt_text ?? "")
          .filter((t) => t.length > 0),
        favorites: listing.num_favorers ?? 0,
        views: listing.views,
        has_video: hasVideo,
        price: listing.price,
        is_personalizable: listing.is_personalizable,
        variation_count: listing.has_variations ? 2 : 0,
      };

      const result = scoreListing(payload);
      const formatted = formatScoreResult(result);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                listing_id: listingId,
                url: params.url,
                title: listing.title,
                ...formatted,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error analyzing listing URL: ${message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ─── Tool 3: get_optimization_tips ─────────────────────────────────────────────

server.tool(
  "get_optimization_tips",
  `Get prioritized optimization tips for an Etsy listing. Scores the listing and returns actionable steps ordered by impact (critical issues first).

Each tip includes:
- Priority level (critical/high/medium/low)
- What's wrong and why it matters
- Current state vs target state
- Course module reference for deeper learning

Use this when you want focused action items rather than a full score breakdown.`,
  {
    title: z.string().describe("The Etsy listing title."),
    tags: z.array(z.string()).describe("Array of listing tags."),
    description: z.string().describe("The full listing description."),
    photos_count: z
      .number()
      .int()
      .min(0)
      .max(10)
      .describe("Number of listing photos."),
    alt_texts: z
      .array(z.string())
      .optional()
      .default([])
      .describe("Alt texts for listing images."),
    favorites: z.number().int().min(0).optional().default(0),
    has_video: z.boolean().optional(),
    price: z.number().min(0).optional(),
    is_personalizable: z.boolean().optional(),
    variation_count: z.number().int().min(0).optional(),
  },
  async (params) => {
    try {
      const payload: ListingPayload = {
        title: params.title,
        tags: params.tags,
        description: params.description,
        photos_count: params.photos_count,
        alt_texts: params.alt_texts ?? [],
        favorites: params.favorites ?? 0,
        has_video: params.has_video,
        price: params.price,
        is_personalizable: params.is_personalizable,
        variation_count: params.variation_count,
      };

      const result = scoreListing(payload);

      // Sort issues by severity priority
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const sortedIssues = [...result.all_issues].sort(
        (a, b) =>
          severityOrder[a.severity] - severityOrder[b.severity],
      );

      const tips = sortedIssues.map((issue, index) => ({
        priority: index + 1,
        severity: issue.severity,
        category: issue.category,
        action: issue.message,
        why: issue.detail,
        current: issue.currentValue,
        target: issue.targetValue,
        courseRef: issue.courseRef,
      }));

      // Category-level summary
      const categoryGaps = result.categories
        .map((cat) => ({
          category: cat.name,
          score: `${cat.points}/${cat.maxPoints}`,
          percentage: Math.round((cat.points / cat.maxPoints) * 100),
          issueCount: cat.issues.length,
        }))
        .sort((a, b) => a.percentage - b.percentage);

      const output = {
        summary: {
          score: result.total_score,
          grade: result.grade,
          totalIssues: result.all_issues.length,
          criticalIssues: result.all_issues.filter(
            (i) => i.severity === "critical",
          ).length,
        },
        weakestCategories: categoryGaps,
        actionItems: tips,
        quickWins: tips
          .filter(
            (t) =>
              t.severity === "critical" || t.severity === "high",
          )
          .slice(0, 5)
          .map((t) => `${t.severity.toUpperCase()}: ${t.action}`),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error generating optimization tips: ${message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ─── Tool 4: check_title_seo ──────────────────────────────────────────────────

server.tool(
  "check_title_seo",
  `Quick SEO check of an Etsy listing title. Analyzes:
- Character utilization (target: 136-140 of 140 chars)
- Long-tail keyword structure (multi-word descriptive phrases)
- Keyword diversity (unique vs repeated words)
- Front-loading (buyer keywords in first 40 chars)
- Punctuation usage (should be clean, no pipe/comma separators)
- Consecutive word repetition
- Product vs purpose keyword balance

Returns specific issues and a title-only score out of 28 points.`,
  {
    title: z
      .string()
      .describe(
        "The Etsy listing title to check (max 140 characters).",
      ),
  },
  async (params) => {
    try {
      // Score just the title category by running the full scorer with minimal payload
      const payload: ListingPayload = {
        title: params.title,
        tags: [],
        description: "",
        photos_count: 0,
        alt_texts: [],
        favorites: 0,
      };

      const result = scoreListing(payload);
      const titleCategory = result.categories.find(
        (c) => c.key === "title_seo",
      );

      if (!titleCategory) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Title SEO category not found in scoring engine.",
            },
          ],
          isError: true,
        };
      }

      const titleLength = params.title.length;
      const output = {
        title: params.title,
        titleLength,
        maxLength: 140,
        charactersRemaining: Math.max(0, 140 - titleLength),
        score: `${titleCategory.points}/${titleCategory.maxPoints}`,
        percentage: Math.round(
          (titleCategory.points / titleCategory.maxPoints) * 100,
        ),
        subMetrics: titleCategory.subMetrics.map((sm) => ({
          metric: sm.name,
          score: `${sm.points}/${sm.maxPoints}`,
          status:
            sm.points === sm.maxPoints
              ? "PASS"
              : sm.points > 0
                ? "PARTIAL"
                : "FAIL",
        })),
        issues: titleCategory.issues.map((issue) => ({
          severity: issue.severity,
          message: issue.message,
          detail: issue.detail,
          current: issue.currentValue,
          target: issue.targetValue,
        })),
        tips:
          titleLength < 136
            ? [
                `Add ${136 - titleLength} more characters to maximize SEO coverage`,
                "Use long-tail keyword phrases (3-5 words each)",
                "Front-load your most important buyer keywords",
                "Avoid punctuation separators (pipes, commas, dashes)",
              ]
            : titleLength <= 140
              ? [
                  "Great character utilization! Focus on keyword quality.",
                ]
              : [
                  `Title is ${titleLength - 140} characters over the 140-char limit — Etsy will truncate it`,
                ],
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error checking title SEO: ${message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ─── Tool 5: check_tags ────────────────────────────────────────────────────────

server.tool(
  "check_tags",
  `Analyze Etsy listing tags for SEO optimization. Checks:
- Slot usage: Are all 13 tag slots filled?
- Multi-word tags: Are tags long-tail phrases (not single words)?
- Tag cannibalization: Do tags repeat the same words across slots?
- Title-tag alignment: Do tags reinforce AND expand on title keywords? (sweet spot: 40-70% overlap)
- Generic tags: Are any tags too broad (e.g., "gift", "decor")?

Returns a tag-only score out of 20 points with specific fix suggestions.`,
  {
    title: z
      .string()
      .describe(
        "The listing title (needed to check title-tag alignment).",
      ),
    tags: z
      .array(z.string())
      .describe(
        "Array of listing tags (up to 13, each up to 20 characters).",
      ),
  },
  async (params) => {
    try {
      const payload: ListingPayload = {
        title: params.title,
        tags: params.tags,
        description: "",
        photos_count: 0,
        alt_texts: [],
        favorites: 0,
      };

      const result = scoreListing(payload);
      const tagCategory = result.categories.find(
        (c) => c.key === "tag_seo",
      );

      if (!tagCategory) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Tag SEO category not found in scoring engine.",
            },
          ],
          isError: true,
        };
      }

      // Analyze individual tags
      const tagAnalysis = params.tags.map((tag) => {
        const wordCount = tag
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean).length;
        const charCount = tag.trim().length;
        return {
          tag: tag.trim(),
          wordCount,
          charCount,
          isMultiWord: wordCount >= 2,
          isTooLong: charCount > 20,
          isTooGeneric: [
            "gift",
            "gifts",
            "decor",
            "wall decor",
            "wall art",
            "print",
            "prints",
            "art",
            "custom gift",
            "home decor",
            "etsy gift",
          ].includes(tag.trim().toLowerCase()),
        };
      });

      const output = {
        tagCount: params.tags.length,
        maxTags: 13,
        emptySlots: Math.max(0, 13 - params.tags.length),
        score: `${tagCategory.points}/${tagCategory.maxPoints}`,
        percentage: Math.round(
          (tagCategory.points / tagCategory.maxPoints) * 100,
        ),
        subMetrics: tagCategory.subMetrics.map((sm) => ({
          metric: sm.name,
          score: `${sm.points}/${sm.maxPoints}`,
          status:
            sm.points === sm.maxPoints
              ? "PASS"
              : sm.points > 0
                ? "PARTIAL"
                : "FAIL",
        })),
        tagAnalysis,
        issues: tagCategory.issues.map((issue) => ({
          severity: issue.severity,
          message: issue.message,
          detail: issue.detail,
          current: issue.currentValue,
          target: issue.targetValue,
        })),
        singleWordTags: tagAnalysis
          .filter((t) => !t.isMultiWord)
          .map((t) => t.tag),
        genericTags: tagAnalysis
          .filter((t) => t.isTooGeneric)
          .map((t) => t.tag),
        tooLongTags: tagAnalysis
          .filter((t) => t.isTooLong)
          .map((t) => `${t.tag} (${t.charCount} chars)`),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error checking tags: ${message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ─── Resource: scoring-methodology ─────────────────────────────────────────────

server.resource(
  "scoring-methodology",
  "listing-doctor://scoring-methodology",
  {
    description:
      "The complete Listing Doctor scoring methodology — 5 quality categories, point weights, grade thresholds, and sub-metric definitions. Use this to understand how scores are calculated.",
    mimeType: "application/json",
  },
  async () => {
    const info = getVersionInfo();

    const methodology = {
      name: "Listing Doctor Scoring Engine",
      version: info.version,
      versionName: info.name,
      description: info.description,
      totalMaxPoints: info.totalMaxPoints,
      gradeThresholds: {
        A: { min: info.gradeThresholds.A, label: "Excellent — listing is well-optimized" },
        B: { min: info.gradeThresholds.B, label: "Good — minor improvements possible" },
        C: { min: info.gradeThresholds.C, label: "Fair — several areas need work" },
        D: { min: info.gradeThresholds.D, label: "Poor — significant optimization needed" },
        F: { min: 0, label: "Failing — major issues across multiple categories" },
      },
      categories: info.categories.map((cat) => ({
        key: cat.key,
        name: cat.name,
        maxPoints: cat.maxPoints,
        percentageOfTotal: Math.round(
          (cat.maxPoints / info.totalMaxPoints) * 100,
        ),
        subMetrics: cat.subMetrics.map((sm) => ({
          key: sm.key,
          name: sm.name,
          maxPoints: sm.maxPoints,
        })),
      })),
      engagementTracking: {
        note: "Engagement (favorites, views, sales) is tracked SEPARATELY from the quality score. It's a RESULT of quality, not a component.",
        metrics: [
          "Favorites per view ratio",
          "Conversion rate by price tier",
          "Health label: strong / moderate / weak / insufficient_data",
        ],
      },
      issueSeverityLevels: {
        critical:
          "Major problem that severely impacts listing performance. Fix immediately.",
        high: "Significant issue that meaningfully reduces score. Fix soon.",
        medium:
          "Moderate improvement opportunity. Address when optimizing.",
        low: "Minor tweak. Nice to have but lower priority.",
      },
    };

    return {
      contents: [
        {
          uri: "listing-doctor://scoring-methodology",
          mimeType: "application/json",
          text: JSON.stringify(methodology, null, 2),
        },
      ],
    };
  },
);

// ─── Prompt: optimize-etsy-listing ─────────────────────────────────────────────

server.prompt(
  "optimize-etsy-listing",
  `A step-by-step guide for optimizing an Etsy listing using Listing Doctor's scoring engine. Walk through each optimization area systematically.`,
  {
    title: z
      .string()
      .optional()
      .describe("Current listing title (if available)."),
    tags: z
      .string()
      .optional()
      .describe("Current tags as comma-separated string (if available)."),
    description: z
      .string()
      .optional()
      .describe(
        "Current listing description (if available, can be abbreviated).",
      ),
  },
  async (params) => {
    const hasExistingListing = params.title || params.tags || params.description;

    const messages: Array<{
      role: "user" | "assistant";
      content: { type: "text"; text: string };
    }> = [];

    if (hasExistingListing) {
      messages.push({
        role: "user",
        content: {
          type: "text",
          text: `I want to optimize my Etsy listing. Here's what I have:

${params.title ? `Title: ${params.title}` : "Title: (not provided)"}
${params.tags ? `Tags: ${params.tags}` : "Tags: (not provided)"}
${params.description ? `Description: ${params.description}` : "Description: (not provided)"}

Please analyze this listing and help me optimize it step by step.`,
        },
      });
    } else {
      messages.push({
        role: "user",
        content: {
          type: "text",
          text: "I want to optimize my Etsy listing for better SEO and conversion. Please guide me through the process step by step.",
        },
      });
    }

    messages.push({
      role: "assistant",
      content: {
        type: "text",
        text: `I'll help you optimize your Etsy listing using the Listing Doctor scoring engine. Let's work through this systematically.

**Step 1: Score the Current Listing**
${hasExistingListing ? "Let me first score your current listing to identify the biggest opportunities." : "First, I need your listing details. Please provide: title, tags, description, number of photos, and alt texts."}

Use the \`score_listing\` tool to get a baseline score.

**Step 2: Fix Critical & High-Severity Issues First**
After scoring, use \`get_optimization_tips\` to get prioritized action items. Focus on critical and high severity issues — these have the biggest impact.

**Step 3: Title SEO Optimization**
Use \`check_title_seo\` to deep-dive into the title. Key targets:
- Use 136-140 of the 140 character limit
- Pack in long-tail keyword phrases (3-5 words each)
- Front-load buyer-intent keywords in the first 40 characters
- No pipes, commas, or dashes separating keyword groups
- High keyword diversity (78%+ unique words)

**Step 4: Tag Optimization**
Use \`check_tags\` to analyze tags. Key targets:
- Fill all 13 tag slots
- Every tag should be multi-word (2+ words)
- No generic tags like "gift" or "decor" alone
- Tags should align 40-70% with title keywords (reinforce AND expand)
- Minimize repeated words across tags

**Step 5: Description Optimization**
Score the description for:
- SEO opener: First 2 sentences should mirror title keywords
- Mobile-scannable format: emoji bullets, short paragraphs, line breaks
- Structured sections: Details, How to Order, Shipping, Policies
- Length: 1,500+ characters
- Detail bullets: 3-5 bullet points with product specs

**Step 6: Photos & Visual**
- Use all 10 photo slots
- Add a video (course says non-negotiable)
- Alt text on every image with relevant keywords
- Alt text quality: 4+ descriptive words, 12-180 characters

**Step 7: Re-Score and Verify**
Run \`score_listing\` again with your optimized content to verify improvement. Target: Grade B (80+) or A (90+).

Let's start with Step 1!`,
      },
    });

    return { messages };
  },
);

// ─── Smithery Sandbox Export ──────────────────────────────────────────────────

/**
 * Export for Smithery registry scanning.
 * Returns a fresh server instance with no transport attached.
 */
export function createSandboxServer() {
  const sandboxServer = new McpServer({
    name: "listing-doctor",
    version: "1.0.0",
    description:
      "Listing Doctor — Etsy listing optimization scoring engine. Analyze titles, tags, descriptions, photos, and more for SEO and conversion optimization.",
  });

  // Re-register all tools on the sandbox instance
  // (Smithery just needs to see the tool schemas, not actually run them)
  sandboxServer.tool(
    "score_listing",
    "Score an Etsy listing across all 6 SEO and conversion categories. Returns a score (0-100), letter grade (A-F), detailed category breakdown, issues found, and prioritized fix suggestions.",
    { title: z.string(), tags: z.array(z.string()), description: z.string(), photos_count: z.number(), alt_texts: z.array(z.string()), favorites: z.number().optional(), views: z.number().optional(), has_video: z.boolean().optional(), price: z.number().optional() },
    async () => ({ content: [{ type: "text" as const, text: "sandbox" }] }),
  );
  sandboxServer.tool(
    "analyze_listing_url",
    "Analyze an Etsy listing by its URL. Fetches listing data from the Etsy API and scores it.",
    { url: z.string() },
    async () => ({ content: [{ type: "text" as const, text: "sandbox" }] }),
  );
  sandboxServer.tool(
    "get_optimization_tips",
    "Get prioritized optimization tips for an Etsy listing.",
    { title: z.string(), tags: z.array(z.string()), description: z.string(), photos_count: z.number() },
    async () => ({ content: [{ type: "text" as const, text: "sandbox" }] }),
  );
  sandboxServer.tool(
    "check_title_seo",
    "Quick SEO analysis of an Etsy listing title.",
    { title: z.string() },
    async () => ({ content: [{ type: "text" as const, text: "sandbox" }] }),
  );
  sandboxServer.tool(
    "check_tags",
    "Analyze Etsy listing tags for coverage, duplication, and optimization opportunities.",
    { title: z.string(), tags: z.array(z.string()) },
    async () => ({ content: [{ type: "text" as const, text: "sandbox" }] }),
  );

  return sandboxServer;
}

// ─── Start Server ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Listing Doctor MCP server running on stdio");
}

// Only start stdio transport when running directly (not imported by Smithery)
const isMainModule = typeof require !== "undefined" && require.main === module;
const isDirectRun = process.argv[1]?.includes("index");
if (isMainModule || isDirectRun) {
  main().catch((error) => {
    console.error("Fatal error starting MCP server:", error);
    process.exit(1);
  });
}
