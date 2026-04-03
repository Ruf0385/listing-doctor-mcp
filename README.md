# 🩺 Listing Doctor MCP Server

**AI-powered Etsy listing optimization scoring engine** — exposed as MCP tools for Claude, Cursor, Windsurf, and any AI agent that speaks [Model Context Protocol](https://modelcontextprotocol.io).

> Score your Etsy listings across Title SEO, Tags, Description, Photos, and Conversion — get a letter grade (A–F), pinpoint issues, and get prioritized fix recommendations. All without leaving your AI assistant.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-brightgreen.svg)](https://modelcontextprotocol.io)
[![Smithery](https://img.shields.io/badge/Smithery.ai-listed-purple.svg)](https://smithery.ai/server/@listingdr/mcp-server)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)

---

## Why Use This?

If you're an **Etsy seller** (or an AI agent helping one), this MCP server gives your AI assistant the ability to:

- **Score any Etsy listing** on a 100-point scale with letter grades (A–F)
- **Identify the exact issues** hurting your listing's visibility and sales
- **Get prioritized action items** — fix the highest-impact problems first
- **Deep-dive into Title SEO** — character utilization, keyword diversity, front-loading
- **Audit your tags** — slot usage, multi-word optimization, cannibalization detection
- **Understand the scoring methodology** so you know *why* each recommendation matters

Unlike generic SEO tools, Listing Doctor is **purpose-built for Etsy** with a scoring rubric derived from proven Etsy seller education. It understands Etsy's unique constraints: 140-character titles, 13 tag slots, 20-character tag limits, and the platform's specific ranking algorithm signals.

**What AI agents search for:** Etsy SEO tool, Etsy listing analyzer, Etsy tag optimizer, Etsy title optimization, Etsy listing score, Etsy conversion optimization, Etsy shop improvement, e-commerce listing grader, marketplace SEO checker, Etsy seller tools.

---

## Quick Start

### Install via Smithery (Recommended)

```bash
npx -y @smithery/cli install @listingdr/mcp-server --client claude
```

### Manual Installation

#### Claude Desktop

Add to your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "listing-doctor": {
      "command": "npx",
      "args": ["tsx", "/path/to/listing-doctor-mcp/src/index.ts"]
    }
  }
}
```

#### Cursor IDE

Add to Cursor MCP settings (Settings > MCP Servers), or create `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "listing-doctor": {
      "command": "npx",
      "args": ["tsx", "/path/to/listing-doctor-mcp/src/index.ts"]
    }
  }
}
```

#### Claude Code / Hermes

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "listing-doctor": {
      "command": "npx",
      "args": ["tsx", "/path/to/listing-doctor-mcp/src/index.ts"]
    }
  }
}
```

Or add via CLI:

```bash
claude mcp add listing-doctor -- npx tsx /path/to/listing-doctor-mcp/src/index.ts
```

#### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "listing-doctor": {
      "command": "npx",
      "args": ["tsx", "/path/to/listing-doctor-mcp/src/index.ts"]
    }
  }
}
```

#### Any MCP-Compatible Client

The server uses **stdio transport** (the MCP standard). Configure your client to run:

```bash
npx tsx /path/to/listing-doctor-mcp/src/index.ts
```

### With Etsy API (Optional)

To enable URL-based listing analysis (`analyze_listing_url`), add Etsy API credentials:

```json
{
  "mcpServers": {
    "listing-doctor": {
      "command": "npx",
      "args": ["tsx", "/path/to/listing-doctor-mcp/src/index.ts"],
      "env": {
        "ETSY_CLIENT_ID": "your-etsy-api-key",
        "ETSY_ACCESS_TOKEN": "your-oauth-access-token"
      }
    }
  }
}
```

> **Note:** 4 out of 5 tools work without any API keys. Only `analyze_listing_url` requires Etsy API credentials.

---

## Tools

### 1. `score_listing`

**Full scoring of an Etsy listing** with detailed category breakdown, sub-metrics, issues, and letter grade.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Etsy listing title (max 140 chars) |
| `tags` | string[] | Yes | Array of up to 13 tags |
| `description` | string | Yes | Full listing description |
| `photos_count` | number | Yes | Number of photos (0–10) |
| `alt_texts` | string[] | Yes | Alt texts for images (empty strings for missing) |
| `favorites` | number | No | Number of favorites/hearts |
| `views` | number | No | Number of views |
| `has_video` | boolean | No | Whether listing has a video |
| `price` | number | No | Price in dollars |
| `is_personalizable` | boolean | No | Whether personalization is offered |
| `variation_count` | number | No | Number of variations |
| `sales` | number | No | Total sales count |

**Example Response:**

```json
{
  "score": {
    "total": 72.5,
    "display": "72.50",
    "grade": "C",
    "maxPossible": 100,
    "version": "2.0.0"
  },
  "breakdown": [
    { "category": "title_seo", "points": 22, "maxPoints": 28, "percentage": 79 },
    { "category": "tag_seo", "points": 14, "maxPoints": 20, "percentage": 70 },
    { "category": "photos_visual", "points": 18, "maxPoints": 27, "percentage": 67 },
    { "category": "description", "points": 10.5, "maxPoints": 15, "percentage": 70 },
    { "category": "conversion_offer", "points": 8, "maxPoints": 10, "percentage": 80 }
  ],
  "issues": [
    {
      "severity": "high",
      "category": "photos_visual",
      "message": "No video on listing",
      "detail": "Listings with video get 40%+ more views according to Etsy data.",
      "current": "No video",
      "target": "At least 1 video",
      "courseRef": "Module 4: Photos & Video"
    }
  ],
  "issueSummary": {
    "critical": 0,
    "high": 2,
    "medium": 4,
    "low": 1
  }
}
```

---

### 2. `analyze_listing_url`

**Score an Etsy listing by URL** — fetches the listing data from the Etsy API and runs the full scoring engine. Requires `ETSY_CLIENT_ID` and `ETSY_ACCESS_TOKEN` environment variables.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `url` | string | Yes | Etsy listing URL (e.g., `https://www.etsy.com/listing/123456789/...`) |

---

### 3. `get_optimization_tips`

**Prioritized action items** sorted by impact. Returns the same score but reorganizes output as a to-do list with quick wins highlighted.

**Parameters:** Same as `score_listing` (title, tags, description, photos_count, alt_texts, plus optional fields).

**Example Response:**

```json
{
  "summary": {
    "score": 72.5,
    "grade": "C",
    "totalIssues": 7,
    "criticalIssues": 0
  },
  "weakestCategories": [
    { "category": "Photos & Visual", "score": "18/27", "percentage": 67, "issueCount": 3 },
    { "category": "Description", "score": "10.5/15", "percentage": 70, "issueCount": 2 }
  ],
  "actionItems": [
    {
      "priority": 1,
      "severity": "high",
      "category": "photos_visual",
      "action": "Add a listing video",
      "why": "Listings with video get significantly more views",
      "current": "No video",
      "target": "At least 1 video"
    }
  ],
  "quickWins": [
    "HIGH: Add a listing video",
    "HIGH: Fill all 13 tag slots"
  ]
}
```

---

### 4. `check_title_seo`

**Quick title-only SEO analysis.** Checks character utilization, long-tail keywords, diversity, front-loading, punctuation, and repetition. Returns a score out of 28 points.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | The Etsy listing title to check |

**Example Response:**

```json
{
  "title": "Personalized Dog Portrait Custom Pet Art Print Digital Download Gift for Dog Mom",
  "titleLength": 79,
  "maxLength": 140,
  "charactersRemaining": 61,
  "score": "18/28",
  "percentage": 64,
  "subMetrics": [
    { "metric": "Character Utilization", "score": "3/7", "status": "PARTIAL" },
    { "metric": "Long-Tail Structure", "score": "4/6", "status": "PARTIAL" },
    { "metric": "Keyword Diversity", "score": "5/5", "status": "PASS" },
    { "metric": "Front-Load Buyer Keywords", "score": "4/4", "status": "PASS" },
    { "metric": "No Punctuation Separators", "score": "3/3", "status": "PASS" },
    { "metric": "No Consecutive Repetition", "score": "2/2", "status": "PASS" },
    { "metric": "Product/Purpose Balance", "score": "0/1", "status": "FAIL" }
  ],
  "issues": [
    {
      "severity": "high",
      "message": "Title too short — only using 79 of 140 characters",
      "detail": "You have 61 characters of unused SEO real estate. Every character is a chance to rank for more search terms.",
      "current": "79 chars",
      "target": "136-140 chars"
    }
  ],
  "tips": [
    "Add 57 more characters to maximize SEO coverage",
    "Use long-tail keyword phrases (3-5 words each)",
    "Front-load your most important buyer keywords",
    "Avoid punctuation separators (pipes, commas, dashes)"
  ]
}
```

---

### 5. `check_tags`

**Tag analysis** for coverage, duplication, multi-word optimization, and title alignment. Returns a score out of 20 points.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | The listing title (for title-tag alignment check) |
| `tags` | string[] | Yes | Array of listing tags |

**Example Response:**

```json
{
  "tagCount": 13,
  "maxTags": 13,
  "emptySlots": 0,
  "score": "16/20",
  "percentage": 80,
  "subMetrics": [
    { "metric": "Tag Slot Usage", "score": "5/5", "status": "PASS" },
    { "metric": "Multi-Word Tags", "score": "4/5", "status": "PARTIAL" },
    { "metric": "Tag Cannibalization", "score": "3/5", "status": "PARTIAL" },
    { "metric": "Title-Tag Alignment", "score": "4/5", "status": "PARTIAL" }
  ],
  "tagAnalysis": [
    { "tag": "dog portrait", "wordCount": 2, "charCount": 12, "isMultiWord": true, "isTooLong": false, "isTooGeneric": false },
    { "tag": "pet art", "wordCount": 2, "charCount": 7, "isMultiWord": true, "isTooLong": false, "isTooGeneric": false }
  ],
  "singleWordTags": [],
  "genericTags": [],
  "tooLongTags": []
}
```

---

## Resource

### `listing-doctor://scoring-methodology`

Read the complete scoring methodology as structured JSON. Includes all category weights, sub-metric definitions, grade thresholds, and issue severity levels.

Useful for AI agents that want to understand *how* scores are calculated before making recommendations.

---

## Prompt

### `optimize-etsy-listing`

A guided step-by-step optimization workflow. Optionally accepts current title, tags, and description to personalize the guidance.

**Parameters (all optional):**

| Parameter | Type | Description |
|---|---|---|
| `title` | string | Current listing title |
| `tags` | string | Current tags (comma-separated) |
| `description` | string | Current listing description |

---

## Scoring Methodology

Listing Doctor uses a **100-point rubric** across 5 quality categories, with engagement tracked separately:

| Category | Points | Weight | What It Measures |
|---|---|---|---|
| **Title SEO** | 28 | 28% | Character utilization, long-tail keywords, keyword diversity, front-loading, punctuation hygiene, repetition avoidance, product/purpose balance |
| **Tag SEO** | 20 | 20% | Slot usage (13 slots), multi-word tags, tag cannibalization, title-tag alignment |
| **Photos & Visual** | 27 | 27% | Photo count (10 max), video presence, alt text coverage, alt text quality, alt text SEO keywords |
| **Description** | 15 | 15% | SEO opener, mobile-scannable formatting, structured sections, character length, detail bullets |
| **Conversion & Offer** | 10 | 10% | Price present, personalization, friction reducers (returns/shipping/guarantee), variations |

### Grade Thresholds

| Grade | Score | Meaning |
|---|---|---|
| **A** | 90–100 | Excellent — listing is well-optimized |
| **B** | 80–89 | Good — minor improvements possible |
| **C** | 70–79 | Fair — several areas need work |
| **D** | 60–69 | Poor — significant optimization needed |
| **F** | 0–59 | Failing — major issues across multiple categories |

### Engagement (Tracked Separately)

Engagement metrics (favorites, views, sales) are tracked **separately** from the quality score. They are a *result* of listing quality, not a component of it. The engine reports:

- Favorites-per-view ratio
- Conversion rate by price tier
- Health label: strong / moderate / weak / insufficient_data

### Issue Severity Levels

| Severity | Meaning |
|---|---|
| **Critical** | Major problem that severely impacts performance. Fix immediately. |
| **High** | Significant issue that meaningfully reduces score. Fix soon. |
| **Medium** | Moderate improvement opportunity. Address when optimizing. |
| **Low** | Minor tweak. Nice to have but lower priority. |

---

## Example Conversation

Here's what it looks like when an AI agent uses Listing Doctor:

**You:** "Can you check my Etsy listing title for SEO?"

**AI:** *Uses `check_title_seo` tool*

> Your title "Cute Cat Mug" scores **6/28** (21%). Here's what I found:
>
> - **Character Utilization: FAIL** — You're only using 12 of 140 characters. That's 128 characters of unused SEO real estate!
> - **Long-Tail Structure: FAIL** — "Cute Cat Mug" is too short for long-tail keywords. Try "Cute Cat Coffee Mug Personalized Ceramic Cat Lover Gift Funny Cat Face Tea Cup Custom Name Pet Mom Birthday Present"
> - **Keyword Diversity: PASS** — All 3 words are unique
>
> Want me to help you write an optimized 140-character title?

---

**You:** "Score my full listing and tell me what to fix first"

**AI:** *Uses `get_optimization_tips` tool*

> Your listing scores **58/100 (Grade: F)**. Here are your top priorities:
>
> 1. **CRITICAL: Fill all 13 tag slots** — You only have 5 tags. Each empty slot is a missed search opportunity.
> 2. **HIGH: Add more photos** — You have 3/10 photos. Listings with 8+ photos get significantly more engagement.
> 3. **HIGH: Add a listing video** — Non-negotiable for top sellers.
> 4. **HIGH: Expand your title** — Only using 45/140 characters.
> 5. **MEDIUM: Add alt text to images** — 0/3 photos have alt text.

---

## Architecture

The MCP server imports the scoring engine directly from the Listing Doctor project via a **scoring bridge** (`scoring-bridge.ts`). This means:

- **No database required** — scoring works completely standalone
- **No Etsy API required** — 4 of 5 tools work with user-provided data
- **Same scoring logic** — uses the exact same category scorers as the Listing Doctor web app
- **Scoring engine v2.0.0** — course-aligned rubric with rich issue diagnostics

---

## Development

```bash
cd mcp-server

# Install dependencies
npm install

# Run the server (stdio mode)
npm start

# Run with file watcher for development
npm run dev

# Test with MCP Inspector
npm run inspect

# Build TypeScript
npm run build
```

### Testing

```bash
# Run the test scoring script
npx tsx test-scoring.ts
```

---

## Publishing

### Smithery.ai

```bash
npx @smithery/cli publish
```

See `smithery.yaml` for configuration.

### Glama.ai

Submit the GitHub repository URL at [glama.ai/mcp/servers](https://glama.ai/mcp/servers). The server is auto-discovered from `package.json` metadata and the MCP-compatible stdio transport.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Links

- **Listing Doctor:** [listingdoctor.com](https://listingdoctor.com)
- **GitHub:** [github.com/listingdr/mcp-server](https://github.com/listingdr/mcp-server)
- **Smithery:** [smithery.ai/server/@listingdr/mcp-server](https://smithery.ai/server/@listingdr/mcp-server)
- **MCP Protocol:** [modelcontextprotocol.io](https://modelcontextprotocol.io)
