# PLATFORM_STRUCTURE_SPEC.md — boop Complete System Specification

> **THE MASTER REFERENCE.** Read this before touching ANY code.
> Every term, pipeline stage, UI element, button placement, data shape,
> known bug, and proposed change is documented here.
>
> If a new Claude session reads ONLY this file and nothing else, it should
> be able to understand the entire platform from A to Z and implement any
> planned change without asking for clarification.
>
> Written: Session 10 (2026-06-21). Audited against live codebase.
> Updated by: every session, at session end, before pushing to GitHub.

---

## PART 1 — WHAT BOOP IS

boop is a server-side AI advertising platform that monetises AI crawler
traffic to publisher websites. Built by Aadi (Publisher Implementation
Manager at Dianomi, London) as a competitor to Oasy.ai.

**The business model:**
When an AI crawler (Perplexity, ChatGPT Browse, Grok, Gemini, etc.) visits
a publisher's page, the platform detects it, injects a sponsored text
paragraph into the HTML response, and charges the advertiser CPM. Human
visitors see the original, unmodified page. Revenue splits 80/20:
publisher gets 80%, boop (the platform) gets 20%.

**The core insight (validated in live testing):**
Ad copy containing specific statistics from named authoritative third-party
sources (HMRC, Pensions Policy Institute, NCSC) gets absorbed by AI systems
as editorial fact and cited in their responses to users. Ad copy with
brand-as-subject benefit claims, CTA verbs ("Open a...", "Try..."), or
disclaimer language ("Capital at risk") gets flagged as "a promotional
section" and excluded. This is boop's USP: helping advertisers write copy
that AI systems treat as information rather than advertising.

**Why this matters commercially:**
Publishers are losing traditional ad revenue because AI systems answer
users' questions directly — fewer clicks to publisher sites means fewer
AdSense impressions. Google Network revenue fell 4% YoY as AI Overviews
reduce click-through. boop monetises the AI traffic that's REPLACING
human traffic, rather than competing with it.

**Initial categories:** Finance and Tech (the ad categories, not the
publisher types — any publisher with finance/tech content is eligible).

---

## PART 2 — INFRASTRUCTURE & DEPLOYMENT

| Component | Details |
|-----------|---------|
| Platform (main) | `testbot-two-psi.vercel.app` (Vercel Hobby plan, 12-function limit) |
| GitHub | `github.com/aadithyask99-boop/testbot` (main branch) |
| Database | Upstash Redis (pay-as-you-go), env vars: KV_REST_API_URL, KV_REST_API_TOKEN |
| AI model | Claude Haiku (`claude-haiku-4-5`), env var: ANTHROPIC_API_KEY |
| Finance Weekly origin | `finance-weekly.vercel.app` |
| Finance Weekly Worker | `finance-weekly-worker.projectatlas.workers.dev` |
| Tech Briefing origin | `tech-briefing-tau.vercel.app` |
| Tech Briefing Worker | `tech-briefing-worker.projectatlas.workers.dev` |
| Serverless functions | 10/12 used (see Part 17 for full list) |
| Git PAT (org-scoped) | `github_pat_11CA4XUNI0MiAdKg9gk6lm_...` (in git remote URL) |

**Environment variables required:**
- `KV_REST_API_URL` — Upstash Redis REST URL (set by Vercel-Upstash integration)
- `KV_REST_API_TOKEN` — Upstash Redis token
- `ANTHROPIC_API_KEY` — for Haiku calls (matching, variant selection, Creative Studio)
- `PLATFORM_URL` — defaults to `https://testbot-two-psi.vercel.app`
- `VERCEL_REGION` — auto-set by Vercel, used in /health only

---

## PART 3 — THE MATCHER (Our Auction Mechanism)

**Formal name:** Relevance-Weighted Auction with Dynamic Creative Resolution.
**Casual name:** "The Matcher."

NOT a standard waterfall or header bidding system. Two-phase, content-aware,
with no exact industry equivalent.

### Phase A: Page Classification + Relevance-Weighted Auction
**Question answered:** "Which advertiser's campaign wins this page?"
**Implementation:** `lib/relevance.js` → `runMatch(pageSignals)`
**Input:** `pageSignals = { url, title, metaDescription, firstParagraph, bodySample, publisherCategory? }`

These signals are extracted by the Cloudflare Worker from the publisher's
raw HTML:
- `title` — from `<title>` tag
- `metaDescription` — from `<meta name="description">`
- `firstParagraph` — first `<p>` tag content, truncated to 500 chars
- `bodySample` — ALL paragraph text concatenated (~1500 chars)
- `publisherCategory` — optional, if Worker config declares it

```
STAGE 0 — Cache check
  Key: match:{sha256(url)}, TTL: 24 hours
  Hit → skip to cached result (category + winning campaign ID)
  Miss → proceed through stages 1-5

STAGE 1 — Publisher tag
  If publisherCategory is present in pageSignals, trust it.
  Skip keyword/Haiku classification entirely.
  Currently: Workers pass publisherCategory from their config.

STAGE 2 — Keyword scoring
  Function: scoreCategoryByKeywords()
  Input: title + metaDescription + firstParagraph
  *** KNOWN GAP: does NOT use bodySample yet — should be added ***
  
  Weighted taxonomy match:
    Finance tier 1 (weight 10): isa, pension, stocks, shares, etf, dividend, ...
    Finance tier 2 (weight 6): investment, savings, fund, trading, ...
    Tech tier 1 (weight 10): api, saas, kubernetes, vpn, cybersecurity, ...
    Tech tier 2 (weight 6): software, developer, cloud, startup, ...
  
  Produces 0-1 score per category. If best score >= 0.5 → confident match.
  If < 0.5 → proceed to Stage 3 (Haiku fallback).

STAGE 3 — Haiku classification (LLM fallback)
  ONLY fires if keyword score < 0.5 (cost saving)
  Function: classifyWithHaiku()
  Input: title + metaDescription + bodySample (NOT just firstParagraph —
         uses the full extracted text for better accuracy)
  Haiku returns one word: "finance", "tech", or "other"
  If "other" or Haiku fails → no ad served on this page
  Fallback if Haiku rate-limited/errors → use keyword result as-is
  Cost: ~£0.00003 per call, cached 24h per URL hash

STAGE 4 — Per-campaign relevance scoring + filtering
  Function: scoreCampaignRelevance() + haikuFilterRelevant()
  For each active campaign in the matched category:
    - Score campaign's keywords against page text (0-1 relevance score)
    - Haiku also evaluates borderline cases (pass/fail)
    - Drop campaigns scoring below RELEVANCE_THRESHOLD (currently 0.2)
  Uses bodySample for the Haiku filter step.

STAGE 5 — Relevance-Weighted Auction
  Function: runAuctionFromList()
  Surviving campaigns compared SIMULTANEOUSLY (not sequential):
    effectiveCPM = cpmGBP × relevanceScore
  Highest effectiveCPM wins.
  Budget check: daily spend < budgetDailyGBP AND total spend < budgetTotalGBP
  If winner over budget → next-highest wins, and so on.
  If nobody has budget → no ad served.
  Result cached: match:{sha256(url)} with 24h TTL.
```

**Precompute:** `api/precompute.js` runs a sweep warming Stages 0-3
(category classification). Stages 4-5 (per-campaign scoring + auction)
are NOT precomputed — they depend on live campaign state (budgets, active
status) that changes more often than page topics.

### Phase B: Dynamic Creative Resolution
**Question answered:** "Which specific variant gets injected?"
**Implementation:** `lib/relevance.js` → `selectVariant(winner, pageSignals)`

```
STAGE 6 — Variant cache check
  Key: variant:{sha256(url + '|' + campaignId)}, TTL: 24 hours
  Hit AND variant ID still exists in campaign's current bank → use it
  Hit BUT variant was removed (campaign edited) → cache miss, recompute

STAGE 7 — Haiku variant selection
  Function: haikuSelectVariant()
  Input: ALL variants in winning campaign's bank + page signals
  Haiku picks the single best-fitting variant for THIS page.
  (Same campaign can serve different variants on different pages.)
  Uses bodySample for context.

STAGE 8 — Round-robin fallback
  Function: roundRobinVariant()
  ONLY if Haiku fails (rate limit, auth error, timeout).
  Atomic per-campaign counter in KV, cycles through variants deterministically.
  
  Result cached: variant:{sha256(url + '|' + campaignId)} with 24h TTL.
```

**NOT precomputed.** Comment in code: "depends on live campaign state and
should NOT be precomputed." Resolves on first real request after cache miss.

### Triggering fresh resolution
When an advertiser saves a campaign with new/changed variants:
1. `variantsChanged()` detects the change (compares old vs new variant array)
2. `invalidatePrecomputeCaches()` clears relevant match: and variant: caches
3. `scheduleCrawls(category, 60000)` — after 60 second delay, fires synthetic
   PerplexityBot crawls to ALL pages in that category via Worker URLs
4. Workers call /match → fresh Stages 4-8 run → new results cached
5. Manual alternative: "Crawl Finance/Tech/All" buttons fire immediately (0ms)

---

## PART 4 — ADVERTISER PORTAL (Current State)

**URL:** `/ui/advertiser/{slug}` (e.g. `/ui/advertiser/trading-212`)
**Scoped by:** `advId` — only shows data for this one advertiser
**Polling:** auto-refreshes every 15 seconds
**Data source:** `GET /dashboard?view=advertiser&advId={advId}`

### Section 1: Summary Cards (top row, 4-5 cards in a grid)

| Card | Main value | Subtitle | Color | Notes |
|------|-----------|----------|-------|-------|
| Status | "Active" or "Paused" | "CPM £{cpmGBP}" | Green if active | — |
| Total impressions | formatted number | "{viewable} viewable" | Blue | — |
| Total spend | "£{totalSpendGBP}" | "vCPM £{blendedVcpmGBP}" | Green | — |
| Daily budget used | "{pct}%" | "£{dailySpend} / £{dailyBudget}" | Default, or amber if ≥80% | — |
| ⚠ Approaching cap | (empty) | "Daily budget exhausted" or "Within {n}% of daily cap" | Amber | ONLY appears if daily budget used ≥ 80% |

### Section 2: Spend Sparkline
- Label: "Spend, last 7 days" with subtitle "Daily spend trend"
- 7 vertical bars, green (`#bbf7d0`), heights proportional to value
- **KNOWN ISSUE:** Currently uses SIMULATED data (random variance around
  today's actual spend), NOT real daily historical series. Real daily
  spend series are not yet stored in KV. Fixing this requires adding
  `spend:daily:{campaignId}:{date}` reads for the past 7 days.

### Section 3: Campaign Performance Table
- Label: "Campaign performance" with subtitle "Where your ad is currently serving"
- Table columns: Page | Variant served | Method | Last crawl
- Page: monospace font, shows URL path only (strips domain)
- Variant served: the variant angle text, or "not serving" in grey
- Method: how the match was made (e.g. "keyword", "haiku")
- Last crawl: relative time (e.g. "3m ago", "2h ago")

### Section 4: AI Creative Studio
- Label: "AI Creative Studio" with subtitle explaining the 2+1 output model
- **3 textarea inputs**, each with maxlength=200:
  - Placeholder 1: "Idea 1, e.g. we have 1.6 million users"
  - Placeholder 2: "Idea 2, e.g. our fee is 0.15% vs industry average 0.45%"
  - Placeholder 3: "Idea 3, e.g. simple and easy to use (can be promotional)"
- **2 buttons side by side:**
  - [Generate variants] (black, primary) — calls `/admin/creative-studio`
  - [Clear] (white, secondary) — clears all 3 inputs + results
- **Message area** (`#csMsg`) — shows success/error after generation
- **Results area** (`#csResults`) — appears after generation:
  - Each result is a card (`.rec` class) containing:
    - Angle label + badge: green "FACT-LED" or amber "PROMO"
    - Variant text
    - [Add to my variants] button — on click: disabled → "Adding..." → "✓ Added" (green, stays disabled)
  - Up to 3 results (2 fact-led + 1 promo), may be fewer if safety filter drops some

**Creative Studio safety model (server-side, in `api/admin.js`):**
1. INPUT GATE: count ideas containing figures (regex: digits, million/billion/thousand).
   If fewer than 2 of 3 → refuse with error, no Haiku call made.
2. Quote sanitisation: strip `"` `"` `"` from ideas before embedding in prompt.
3. Haiku call with journalist-vs-copywriter prompt (see Part 7 for full prompt text).
4. OUTPUT SAFETY: `outputTraceable()` checks every number in output traces to input.
   Numbers in brand name excluded (e.g. "212" in "Trading 212").
   Years (2024-2026) excluded. Untraceable → variant dropped.
5. Em dash backstop: `stripEmDash()` replaces `—` with `, ` in output text.
6. Null-text filter: variants with null/empty text are dropped (for honest "skipped" slots).

### Section 5: Campaign (contains 3 sub-sections)

#### Sub-section 5a: Settings
- Label divider: "SETTINGS" (uppercase, grey, small)
- **4 fields in a row:**
  - CPM (£): number input, step 0.01, min 1, `id="setCpm"`
  - Daily budget (£): number input, step 1, min 1, `id="setDailyBudget"`
  - Total budget (£): number input, step 1, min 1, `id="setTotalBudget"`
  - Status: dropdown (`<select>`), options "Active" / "Paused", `id="setActive"`
- **Keywords row:** text input, comma-separated, `id="setKeywords"`
- **Matching description row:** textarea, maxlength 300, `id="setMatchDesc"`
- [Save settings] button (black, primary) — `id="saveSettingsBtn"`
- Message area `#setMsg` — shows "Settings saved." in green or error in red
- **Dirty-flag guard:** all 5 fields + dropdown have `onfocus="settingsDirty=true"`.
  While `settingsDirty=true`, auto-refresh does NOT overwrite these fields
  (prevents clobbering in-progress edits). Reset to false on successful save.
- **Pre-populated on load** from campaign data (cpmGBP, budgetDailyGBP, etc.)

#### Sub-section 5b: Add a Creative
- Label divider: "ADD A CREATIVE" (uppercase, grey, small)
- Subtitle: "New variants are auto-crawled within 60 seconds of saving"
- **Angle input:** text, maxlength 60, placeholder "Angle, e.g. data-led: cost comparison"
- **Text textarea:** maxlength 280, placeholder "Ad copy (max 280 characters)"
- **Character counter:** "0/280" below textarea, updates on input
- [Add creative] button (black) — `id="addCreativeBtn"`
- Message area `#addCreativeMsg` — shows success + auto-crawl status, or error
- On success: clears both fields, resets char counter, triggers `load()` refresh

#### Sub-section 5c: Ad Variants
- Label divider: "AD VARIANTS" (uppercase, grey, small)
- Subtitle: "Top performer marked · minimum 5 variants required"
- **Each variant row (`.vrow`):**
  - **Remove button** (top-right, float right): "Remove" — confirm dialog,
    disabled if variant count ≤ 5 (shows "min 5 required" text instead).
    On click: disabled → "Removing..." → removes variant from campaign → refreshes.
  - **Edit button** (top-right, float right, left of Remove): "Edit" —
    toggles inline edit form (see below).
  - **Angle label** (bold, 12px) + "TOP PERFORMER" badge (amber background)
    if this variant has the highest impression percentage and pct > 0
  - **Stats line:** "{impressions} impr · {pct}%"
  - **Variant text** (12px, grey-ish #444)
  - **Inline edit form** (hidden by default, shown when Edit clicked):
    - Angle input (pre-filled with current angle, maxlength 60)
    - Text textarea (pre-filled with current text, maxlength 280)
    - [Save] button — updates the variant in-place, refreshes on success
    - [Cancel] button — hides the edit form, shows the text again

### Section 6: Recent Activity
- Label: "Recent activity" with subtitle "AI crawlers that have visited
  pages where you compete"
- **Each activity row (`.actrow`):**
  - Left side: **Platform name** (bold) + " visited " + page URL path
    + line break + outcome: green "won — {variantAngle}" or grey "did not win"
  - Right side: relative timestamp ("3m ago")
- Shows last 10 entries, scoped to this advId's campaigns
- Data source: `recentMatches` from dashboard API

---

## PART 5 — PUBLISHER PORTAL (Current State)

**URL:** `/ui/publisher/{slug}` (e.g. `/ui/publisher/financeweekly`)
**Scoped by:** `pubId`
**Polling:** auto-refreshes every 10 seconds
**Data source:** `GET /dashboard?view=publisher&pubId={pubId}`

### Section 1: Earnings/Traffic Cards (5 cards in a grid)

| Card | Main value | Subtitle | Color |
|------|-----------|----------|-------|
| Your earnings | "£{estimatedGBP}" | "today: £{today} · 80% share" | Green |
| Gross ad spend | "£{grossGBP}" | "advertiser paid" | Green |
| vCPM | "£{vcpmGBP}" | "per 1,000 impressions" | Blue |
| Impressions | formatted total | "{today} today" | Default |
| Fill rate | "{pct}%" or "—" | "served / bot visits" | Default |

### Section 2: Ad Serving — By Page
- Label: "Ad serving — by page" with subtitle "What is currently injected
  on each of your pages"
- Table columns: Page | Serving | Platform | Last crawl
- Page: monospace, URL path only
- Serving: if active → green bold advertiser name + "£{cpm} CPM" + variant
  angle below in small text. If not → red "no campaign"
- Platform: which AI system last crawled (e.g. "Perplexity")
- Last crawl: relative time

### Section 3: Recent Activity
- Label: "Recent activity" with subtitle "AI crawlers that have visited your pages"
- Each row: platform name (bold) + " crawled " + URL path + line break
  + outcome: green "served {advertiser}" or grey "no campaign matched"
  + right-aligned relative timestamp
- Shows last 10 entries, scoped to this pubId's pages
- Data source: `recentVisits` from dashboard API

---

## PART 6 — ADMIN PORTAL (Current State + Proposed)

### Current state (`/ui/admin`)
The admin portal is the ORIGINAL dashboard, predating the portal work.
It has 3 tabs: Overview, Advertiser, Publisher. Contains everything —
all campaigns, all publishers, all stats — with no scoping.

**Overview tab:**
- 6 summary cards: Total impressions, Retrieval/Training split,
  Gross Revenue, Publisher Payouts, Platform Revenue, AI Visits
- Platform breakdown table: per-AI-platform impressions/clicks/CTR
- Precompute Coverage panel
- Live Auction Board (per-page view with Crawl Finance/Tech/All buttons)
- Recent Match Decisions diagnostic table

**Advertiser tab:**
- Campaign list table (all campaigns): Advertiser, CPM, Daily Budget bar,
  Total Budget, Impressions, Viewable, Status, expand button
- Campaign detail panel (on expand): full campaign form with all fields,
  variant list, creative update form

**Publisher tab:**
- Publisher picker (Finance Weekly / Tech Briefing / All)
- Earnings cards
- Per-page serving table
- Platform breakdown table

### Proposed admin redesign (NOT YET BUILT)

Split into `/admin/dashboard` (daily ops) and `/admin/analytics` (deeper):

**`/admin/dashboard` — Daily operations:**
1. Platform health cards: impressions today/total, revenue (gross/pub/platform),
   active campaigns count, fill rate, Haiku calls today, precompute coverage
2. Live Auction Board (existing, keep as-is)
3. Campaign overview table: ALL campaigns, columns = Advertiser, Category,
   CPM, Relevance avg, Daily spend bar + warning, Total spend vs budget,
   Impressions, Status, Actions (pause/edit). Operator spots budget issues here.
4. Publisher overview table: ALL publishers, columns = Name, Pages count,
   Fill rate, Earnings today, Earnings total, Last crawl
5. Recent match decisions (existing diagnostic)
6. Quick actions: Add Campaign button, Manual crawl, Reindex, Reset stats

**`/admin/analytics` — Weekly performance review:**
1. Revenue over time (line/bar chart, 7/14/30 days) — NEEDS daily KV series
2. Impressions by platform (bar chart, Perplexity vs ChatGPT vs Grok etc.)
3. Advertiser performance ranking (by spend, impressions, relevance, fill rate)
4. Publisher performance ranking (by earnings, impressions, fill rate)
5. Variant pattern analysis (data-led vs promo win rates across platform)
6. Precompute + cache health panel
7. Crawl activity timeline (all bot visits, filterable)

---

## PART 7 — AI CREATIVE STUDIO (Full Detail)

**Endpoint:** `POST /admin/creative-studio`
**Request body:** `{ advertiser: "Trading 212", ideas: ["idea1", "idea2", "idea3"] }`
**Response:** `{ message, variants: [{angle, text}], droppedForSafety: N }`

### The Haiku prompt (current, in `api/admin.js`)

The prompt:
1. States Haiku is writing for `{advertiser}` for AI crawler consumption
2. Provides the 3 ideas (sanitised — quote chars replaced with apostrophes)
3. Shows 4 REAL proven-working examples (HMRC ISA millionaires, PPI pension gap,
   IPA 2016 VPN, NCSC ransomware, HL platform scale) — all from live testing
4. Shows 2 REAL proven-failing examples (HL promo + Trading 212 brand-led)
5. Explains the structural difference: journalist ≠ copywriter, it's not about
   "having a number" but about whether a journalist would write the sentence
6. CRITICAL CONSTRAINT: never invent/estimate/introduce any figure not in ideas
7. BRAND NAME rule: at least 1 of 2 fact-led variants must mention the brand,
   but as comparative subject or attribution source, never benefit-claim subject
8. HONESTY TEST: before each fact-led variant, check if the idea gives a REAL
   comparison point (named competitor, industry average, published benchmark).
   If not → set text to null with explanation in angle. Do NOT fabricate vague
   comparisons like "comparable to several established platforms."
9. FORMATTING: never use em dashes (—)
10. Output: exactly 2 fact-led attempts + 1 promo (angle starting with "promo:")

### Known issues with Creative Studio
1. Safety filter too aggressive: reformatted numbers (e.g. "15 basis points"
   instead of "0.15%") fail traceability check and get dropped
2. Honesty test not always followed: Haiku sometimes writes vague filler
   instead of honestly nulling a weak slot
3. Output inconsistency: same 3 ideas can produce very different quality
   results on different runs
4. `bodySample` gap in keyword scoring: Stage 2 doesn't use the full
   extracted page text (uses title + meta + firstParagraph only)

---

## PART 8 — CAMPAIGN MANAGEMENT

### Campaign schema (as stored in KV `campaign:{id}`)
```json
{
  "id": "camp_002",
  "advId": "adv_002",
  "advertiser": "Trading 212",
  "category": "finance",
  "cpmGBP": 10,
  "budgetDailyGBP": 50,
  "budgetTotalGBP": 500,
  "keywords": ["isa", "pension", "investment", "cash isa", "interest"],
  "matchingDescription": "UK Cash ISA and investment platform...",
  "variants": [
    { "id": "v1", "angle": "cash isa rates", "text": "..." },
    { "id": "v2", "angle": "data-led: fee comparison", "text": "..." }
  ],
  "link": "",
  "linkText": "Learn more",
  "advSlug": "trading-212",
  "active": true,
  "startDate": "2026-06-10",
  "endDate": null,
  "updatedAt": "2026-06-21T..."
}
```

### Variant schema
`{ id, angle, text }` — future: optional `focus` tag (free-text, organisational only)

**Variant ID stability:** `normalizeVariants()` preserves existing IDs across
saves. Only genuinely new variants (no existing ID) get a fresh ID (v7, v8...).
This was a Session 10 bug fix — the old version reassigned v1..vN by array
position on EVERY save, which broke Remove and Edit. DO NOT REGRESS.

**Variant limits:** min 5, max 15, maxTextLength 280 (from `config.variantLimits`)

### API endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | /admin/campaign | Create or update campaign (full JSON body) |
| POST | /admin/campaign/pause | `{ id, active: bool }` — toggle active/paused |
| POST | /admin/campaign/delete | `{ id }` — delete campaign |
| GET | /admin | List all campaigns with spend data |
| POST | /admin/seed | Reset to default Vanguard demo campaign |
| POST | /admin/reset-stats | Clear all impression/click/revenue counters |
| POST | /admin/reindex | Rebuild campaigns:{category} index lists |
| POST | /admin/crawl | `{ category: "finance"/"tech"/"all" }` — manual crawl |
| POST | /admin/creative-studio | `{ advertiser, ideas: [3 strings] }` |
| GET | /ad | Fetch current creative for a category (legacy) |

### Missing operations (NOT YET BUILT)
- **Add Campaign UI** — no form in any portal to create a new campaign.
  Currently done via raw `POST /admin/campaign` or JSON payload files.
- **Remove Campaign UI** — no button in the advertiser portal to delete.
  Currently via `POST /admin/campaign/delete` only.
- **Campaign list view** — if an advertiser has multiple campaigns, there's
  no UI to see them all and switch between them.

---

## PART 9 — PUBLISHER SIDE SCHEMAS

### Publisher (in `config.js`)
```javascript
{
  pubId: 'pub_001',
  name: 'Finance Weekly',
  slug: 'financeweekly',
  sitemapUrl: 'https://finance-weekly.vercel.app/sitemap.xml',
  domains: ['finance-weekly.vercel.app', 'finance-weekly-worker.projectatlas.workers.dev'],
  token: 'pk_pub_001_financeweekly',
  floorCPM: null,  // NOT YET IMPLEMENTED
  active: true,
}
```

### Advertiser (in `config.js`)
```javascript
{ advId: 'adv_002', name: 'Trading 212', slug: 'trading-212', status: 'active' }
```
15 advertisers total (adv_001 Vanguard through adv_015 Dropbox).

### Ad Unit (PLANNED — not yet formal schema)
One per page/article. Currently hardcoded in `admin.js`:
```javascript
const PUBLISHER_PAGES = {
  pub_001: ['/articles/best-isa-2026.html', '/articles/pension-vs-isa.html',
            '/articles/dividend-investing.html', '/articles/first-time-buyer.html'],
  pub_002: ['/articles/best-vpn-2026.html', '/articles/best-antivirus.html',
            '/articles/best-broadband.html', '/articles/cloud-storage.html'],
};
const CATEGORY_PUBLISHERS = { finance: ['pub_001'], tech: ['pub_002'] };
```
Formalising into `adUnits[]` per publisher is planned.

### Placement (PLANNED — not yet formal schema)
Named grouping of Ad Units (e.g. "Finance Weekly — Finance vertical").
Currently implicit via CATEGORY_PUBLISHERS. Formalising gives publishers
a real inventory view. Uses Google Ad Manager precedent.

---

## PART 10 — REVENUE MODEL

```
Advertiser pays:    stated CPM (gross)
Publisher receives: 80% of gross CPM × impressions / 1000
Platform receives:  20% of gross CPM × impressions / 1000

Training impressions (GPTBot, ClaudeBot): billed at 30% of campaign CPM
(lower commercial value — 6-18 month lag to model training).

Revenue stored as integer tenths-of-pence (×1000) in KV for atomicity.
Formula: grossTenths = Math.round(cpmGBP * 1000 / 1000)
         pubTenths   = Math.round(grossTenths * 0.8)
         platTenths  = Math.round(grossTenths * 0.2)

Implementation: api/impression.js (primary), lib/auction.js recordImpression (secondary).
```

---

## PART 11 — BOT DETECTION

**Files:** `lib/detector.js`, `lib/combined-detector.js`, `lib/behavioural.js`

Three-layer detection:
1. **UA pattern match** (95% confidence): 40+ crawler patterns, returns platform
   name, crawlerType (retrieval/training), cloakingRisk
2. **Behavioural scoring**: missing Accept-Language (+25), missing cookies (+20),
   no Referer (+10), no browser security headers (+20), non-browser Accept (+15).
   NOTE: rate signal (+30) NEVER fires — `requestsPerMinute` always passed as 1.
3. **Anonymous crawler path**: Chrome UA + missing all 3 browser-proof headers
   (Accept-Language, sec-ch-ua, sec-fetch-mode) = 75% confidence. Catches DeepSeek.

**Excluded from injection (cloakingRisk: true):** Googlebot, GoogleOther ONLY.
**Undetectable:** Grok's browse tool (spoofed iPhone Safari + full browser headers).

---

## PART 12 — CLOUDFLARE WORKER FLOW

**File:** `worker/index.js`

```
Request → Worker
  ├── Check UA against BOT_PATTERNS
  ├── If human:
  │     └── fetch(origin) → return unmodified
  └── If bot:
        ├── fetch(origin, { UA: 'BoopWorkerProxy/1.0' })
        │   (non-bot UA so origin serves clean page)
        ├── Extract page signals: title, meta, firstParagraph, bodySample
        ├── POST /match { url, title, meta, firstParagraph, bodySample, pubId }
        │   → The Matcher runs → returns winning campaign + variant
        ├── If winner: inject variant text as plain <p> into HTML
        ├── POST /impression { campaignId, platform, crawlerType, pubId, url, ... }
        │   → Revenue tracking, impression logging
        └── Return modified HTML to crawler
```

Two Workers deployed:
- Finance Weekly: `finance-weekly-worker.projectatlas.workers.dev`
- Tech Briefing: `tech-briefing-worker.projectatlas.workers.dev`

---

## PART 13 — PORTAL ROUTING

### Current routing
| URL | What | Handler |
|-----|------|---------|
| `/ui` | Chooser (3 links: Advertiser/Publisher/Admin) | dashboard-ui.js |
| `/ui/admin` | Full operator dashboard (3 tabs) | dashboard-ui.js |
| `/ui/advertiser` | List of 15 advertisers | dashboard-ui.js |
| `/ui/advertiser/{slug}` | Scoped advertiser portal | dashboard-ui.js |
| `/ui/publisher` | List of 2 publishers | dashboard-ui.js |
| `/ui/publisher/{slug}` | Scoped publisher portal | dashboard-ui.js |
| Unknown slug | 404 page | dashboard-ui.js |

All `/ui` routes anchored with `^...$` in vercel.json to prevent prefix matching.

### Proposed routing (NOT YET BUILT)
```
/advertiser/{slug}/dashboard   — operational (settings, variants, Creative Studio)
/advertiser/{slug}/analytics   — deeper performance data
/publisher/{slug}/dashboard    — operational (earnings, serving status)
/publisher/{slug}/analytics    — traffic trends, crawl activity
/admin/dashboard               — daily operations (all campaigns, all publishers)
/admin/analytics               — platform-level performance trends
```
Drop `/ui` prefix entirely. Split single portal page into dashboard + analytics.

---

## PART 14 — KV DATA SCHEMA (Complete)

```
# Campaign data
campaign:{id}                              Full campaign object
campaigns:{category}                       Array of campaign IDs

# Impression counters
stats:impressions:total                    All-time total
stats:impressions:date:{YYYY-MM-DD}        Daily total
stats:impressions:type:{retrieval|training} By crawler type
stats:impressions:platform:{name}          By AI platform
stats:impressions:pub:{pubId}:total        Per-publisher total
stats:impressions:pub:{pubId}:date:{date}  Per-publisher daily
stats:bot_visits:total                     All bot visits (incl unserved)
stats:bot_served:total                     Bot visits that got an ad
impr:{type}:{campaignId}:{date}            Per-campaign daily by type
impr:{type}:{campaignId}:total             Per-campaign total by type

# Spend tracking (integer tenths-of-pence)
spend:daily:{campaignId}:{date}            Daily spend
spend:total:{campaignId}                   Total spend

# Revenue tracking (integer tenths-of-pence)
revenue:gross:total                        Total gross revenue
revenue:gross:date:{date}                  Daily gross
revenue:platform:total                     Platform's 20% cut
revenue:platform:date:{date}               Daily platform revenue
revenue:publisher:{pubId}:total            Publisher's 80% share
revenue:publisher:{pubId}:date:{date}      Daily publisher revenue
revenue:advertiser:{advId}:total           Advertiser's total spend
revenue:advertiser:{advId}:date:{date}     Daily advertiser spend

# Match/variant caching
match:{sha256(url)}                        Category classification (24h TTL)
variant:{sha256(url|campaignId)}           Variant selection (24h TTL)
precompute:{sha256(url)}                   Precompute sweep metadata

# Logging
log:recent                                 List (last 100) — bot impressions
log:clicks                                 List (last 100) — publisher clicks
log:adclicks                               List (last 100) — ad clicks

# Click dedup
session:click:{IP}                         String '1' with 300s TTL

# Round-robin variant counter
variant_rr:{campaignId}                    Integer, cycles through variants
```

---

## PART 15 — SERVERLESS FUNCTION SLOTS (10/12)

| # | File | Routes served | Purpose |
|---|------|---------------|---------|
| 1 | api/index.js | `/`, `/articles/*` | Bot detection, injection, impression logging |
| 2 | api/admin.js | `/admin/*`, `/ad` | Campaign CRUD, Creative Studio, crawl, seed |
| 3 | api/dashboard.js | `/dashboard` | Analytics API (3 views) |
| 4 | api/dashboard-ui.js | `/ui/*` | Visual UI (all portal pages) |
| 5 | api/click.js | `/click` | Ad click redirect + tracking |
| 6 | api/sdk.js | `/sdk.js` | Client-side headless browser detection (placeholder) |
| 7 | api/utils.js | `/health`, `/robots.txt`, `/sitemap.xml`, `/ping` | Infrastructure |
| 8 | api/match.js | `/match` | Worker contextual matching endpoint |
| 9 | api/precompute.js | `/precompute` | Category classification sweep |
| 10 | api/impression.js | `/impression` | Revenue tracking (80/20 split) |
| 11 | (free) | — | Reserved for api/publishers.js |
| 12 | (free) | — | Spare |

**HARD LIMIT: 12 on Vercel Hobby. Check before creating ANY new file.**

---

## PART 16 — KNOWN BUGS & AREAS TO IMPROVE

### Bugs
1. **Keyword scoring gap:** `scoreCategoryByKeywords()` only uses title +
   metaDescription + firstParagraph, NOT bodySample. The Worker extracts
   bodySample but Stage 2 ignores it. One-line fix: add bodySample to
   the concatenation. Impact: pages with relevant keywords deep in the
   body text get weaker scores than they should.
2. **Creative Studio safety filter over-aggressive:** reformatted numbers
   (e.g. "15 basis points" ≠ "0.15%") fail traceability. Need fuzzy matching.
3. **Spend sparkline simulated:** uses random variance, not real daily series.
   Need to read `spend:daily:{campaignId}:{date}` for past 7 days.
4. **requestsPerMinute always 1:** behavioural rate signal (+30 pts) never
   fires. Either implement real per-IP KV rate tracking or remove signal.
5. **No Add Campaign / Remove Campaign UI** in any portal.
6. **Creative Studio per-campaign scoping unclear** if advertiser has multiple campaigns.

### Code quality
7. **dashboard-ui.js is ~800+ lines of string concatenation** — extremely
   fragile to edit. Every string escaping rule matters (see CONTINUE.md §14).
   Consider rewriting as a template engine or React artifact in a future session.
8. **Revenue tracking in TWO places:** api/impression.js (primary, used by Workers)
   AND lib/auction.js recordImpression (secondary, used by api/index.js demo path).
   Should consolidate to one path.
9. **PUBLISHER_PAGES and CATEGORY_PUBLISHERS hardcoded** in admin.js — should
   be in config.js or KV for real publisher onboarding.

### UX
10. **No loading states** on portal pages — cards show "Loading..." but no spinner
    or skeleton UI.
11. **No empty states** for new advertisers with zero impressions — cards show
    "0" and "£0.00" which looks broken rather than "just started."
12. **Variant edit form uses browser `alert()` for errors** — should use inline
    messages like the rest of the UI.

---

## PART 17 — PROPOSED CHANGES (Detailed)

### 1. URL routing redesign
**What:** Drop `/ui` prefix, split into dashboard + analytics pages.
**New routes:**
```
/advertiser/{slug}/dashboard    → dashboard-ui.js (operational)
/advertiser/{slug}/analytics    → dashboard-ui.js (performance)
/publisher/{slug}/dashboard     → dashboard-ui.js (operational)
/publisher/{slug}/analytics     → dashboard-ui.js (performance)
/admin/dashboard                → dashboard-ui.js (daily ops, cross-entity)
/admin/analytics                → dashboard-ui.js (platform trends)
```
**vercel.json changes:** remove all `^/ui` routes, add new anchored patterns.
**dashboard-ui.js changes:** add new route handler branches, split existing
single-page content into dashboard vs analytics rendering functions.
**Impact:** advertiser portal's current single page splits into:
- Dashboard: cards + Creative Studio + Campaign (settings + add creative + variants)
- Analytics: sparkline + performance table + recent activity (deeper trends later)

### 2. Publisher-side Ad Unit / Placement formalization
**What:** Turn hardcoded `PUBLISHER_PAGES`/`CATEGORY_PUBLISHERS` into real schemas.
**Schema:** `adUnits: [{ id, url, category, pubId, lastCrawl, fillStatus }]`
**Where:** Move from `admin.js` constants to `config.js` and/or KV.
**Publisher portal change:** replace the simple "by page" table with an Ad Unit
inventory view, grouped by Placement.
**Admin portal change:** add cross-publisher Ad Unit overview table.

### 3. Add Campaign / Remove Campaign
**Add Campaign:**
- Button placement: top of Campaign section in advertiser portal (or admin)
- Form fields: id (auto-generated), category (dropdown: finance/tech),
  cpmGBP, budgetDailyGBP, budgetTotalGBP, keywords, matchingDescription
- On submit: POST /admin/campaign with advId pre-filled
- After creation: redirect to the new campaign's view
**Remove Campaign:**
- Button placement: inside Campaign Settings, bottom, red/destructive styling
- Confirmation dialog with campaign name
- On confirm: POST /admin/campaign/delete
- After deletion: redirect to advertiser list or show empty state

### 4. Variant `focus` tag
**What:** Optional free-text tag on each variant for organizational grouping.
**Schema change:** variant `{ id, angle, text, focus? }`
**UI change:** show focus tag as a small pill/badge on each variant row.
  Add a focus input to Add Creative and Edit Variant forms.
**Matching change:** NONE — purely organizational, does not affect The Matcher.

### 5. Creative Studio quality improvements
**Priority fixes:**
- Fuzzy number matching in `outputTraceable()` (0.15% ≈ 15 basis points)
- Stronger honesty-test enforcement (reject vague filler more aggressively)
- Consider page-context input (let advertiser optionally paste a target page
  URL so Haiku can tailor tone to that specific article)

---

## PART 18 — KEY PRINCIPLES & LEARNINGS

1. **Data-led > promotional.** Variants with third-party stats get cited;
   brand-led CTA copy gets flagged. The "journalist, not copywriter" test.
2. **Crawl time, not query time.** We control injection at crawl time;
   we cannot observe or control what happens when the AI answers a user.
3. **No cloaking for Google.** Googlebot/GoogleOther always get clean pages.
   Perplexity/ChatGPT/Grok are not search engines — no cloaking policy applies.
4. **Plain <p> tags only.** No class, no comments, no CSS — any fingerprint
   risks sanitisation by AI content pipelines.
5. **Never use template literals in dashboard-ui.js.** String concatenation only.
6. **Always add vercel.json routes when adding endpoints.** Three times in
   Session 10, endpoints were built without routes and returned Vercel 404 HTML.
7. **Variant IDs must be stable across saves.** The old version reassigned
   v1..vN by array position on every save — broke Remove/Edit. Fixed.
8. **Document accurately or say "I'm not sure."** Wrong docs are worse than
   no docs — they cause future sessions to build on false assumptions.
9. **Research before copying patterns.** AdWords' Ad Group exists for keyword-bid
   bundling. Our system doesn't have keyword bids. Native platforms (our actual
   analogue) don't use Ad Groups. Don't copy structure from the wrong model.

---

## PART 19 — HOW TO VERIFY THE LIVE SYSTEM

```bash
# 1. Check the chooser page loads
curl https://testbot-two-psi.vercel.app/ui

# 2. Check scoped advertiser portal
curl https://testbot-two-psi.vercel.app/ui/advertiser/trading-212

# 3. Check scoped publisher portal
curl https://testbot-two-psi.vercel.app/ui/publisher/financeweekly

# 4. Check 404 on bad slug
curl https://testbot-two-psi.vercel.app/ui/advertiser/doesnotexist

# 5. Simulate bot impression via Worker
curl -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" \
  https://finance-weekly-worker.projectatlas.workers.dev/articles/best-isa-2026.html

# 6. Check dashboard API (operator view)
curl https://testbot-two-psi.vercel.app/dashboard

# 7. Check dashboard API (scoped advertiser)
curl "https://testbot-two-psi.vercel.app/dashboard?view=advertiser&advId=adv_002"

# 8. Check dashboard API (scoped publisher)
curl "https://testbot-two-psi.vercel.app/dashboard?view=publisher&pubId=pub_001"

# 9. Manual crawl
curl -X POST -H "Content-Type: application/json" \
  -d '{"category":"all"}' \
  https://testbot-two-psi.vercel.app/admin/crawl

# 10. Test Creative Studio
curl -X POST -H "Content-Type: application/json" \
  -d '{"advertiser":"Trading 212","ideas":["1.6 million users","0.15% fee vs 0.45% average","easy to use"]}' \
  https://testbot-two-psi.vercel.app/admin/creative-studio

# 11. List all campaigns
curl https://testbot-two-psi.vercel.app/admin

# 12. Check function count (must be ≤ 12)
grep '"dest"' vercel.json | grep -oP '"/api/[^"]+\.js"' | sort -u | wc -l
```

---

## PART 20 — CROSS-REFERENCES

| Document | Purpose |
|----------|---------|
| PLATFORM_STRUCTURE_SPEC.md | THIS FILE — the master reference |
| CLAUDE.md | Project brain — WHY decisions were made, file map |
| CLAUDE.local.md | Session-start protocol (what to read first) |
| CONTINUE.md | Mistakes, learnings, hard-won knowledge |
| HANDOVER.md | Current task state, next steps, open decisions |
| SESSION_LOG.md | What was built in each session |
| VARIANT_BANK_SPEC.md | Variant schema detail (Session 9-era) |
| PRECOMPUTE_SPEC.md | Precompute sweep mechanics (Session 6) |
| WORKER_SDK_SPEC.md | Cloudflare Worker design (Session 7) |
