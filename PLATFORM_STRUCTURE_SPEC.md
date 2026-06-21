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

### Competitive context — Oasy.ai

Oasy is the closest direct competitor, running the same core mechanism
(detect AI crawler, serve sponsored variant). Researched their public
case studies (Session 10, blog.oasy.ai) — two findings worth internalising:

1. **They measure a different, further-downstream outcome than we do.**
   We measure "did a crawler visit and did we inject something" (crawl-time).
   They measure "did the AI's final answer to a real user question actually
   mention the brand" (query-time), via independent third-party prompt
   monitoring (Promptwatch.com). This is a more persuasive sales artifact —
   "your brand went from 0% to 33% AI-answer visibility" beats "your ad was
   injected 340 times." See Part 17 §6 for our proposed equivalent.

2. **They lead with independent measurement specifically to defeat the
   "grading your own homework" objection.** Worth remembering if/when we
   publish our own case studies — self-reported dashboard numbers will
   face the same skepticism Oasy pre-empted.

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

## PART 4 — ADVERTISER PORTAL (Current State, Session 11)

**Routing (Session 11):** `/advertiser/{slug}/dashboard` (operational) and
`/advertiser/{slug}/analytics` (performance) — see Part 13. Both pages
share a `Dashboard | Analytics` tab nav, fetch the same
`GET /dashboard?view=advertiser&advId={advId}` endpoint, and render
disjoint subsets of the response. Polling: every 15 seconds on both pages.

### DASHBOARD page (`/advertiser/{slug}/dashboard`)

#### Section 1: Summary Cards (top row, grid)
| Card | Main value | Subtitle | Color |
|------|-----------|----------|-------|
| Status | "Active" or "Paused" (ANY campaign active) | "{N} campaigns" | Green if any active |
| Total impressions | formatted number | "{viewable} viewable" | Blue |
| Total spend | "£{totalSpendGBP}" | "vCPM £{blendedVcpmGBP}" | Green |

All three aggregated across ALL of this advertiser's campaigns. The
per-campaign daily-budget-cap warning card (previously Section 1's 4th/5th
cards) moved into the Campaign dropdown's selected-campaign settings view,
since budget caps are inherently per-campaign, not advertiser-wide.

#### Section 2: Campaign (the main working area — multi-campaign, Session 11)

**Why this changed:** the backend (`campaignList` in `api/dashboard.js`)
always supported multiple campaigns per `advId` — every campaign object is
independently keyed in KV. The UI simply never surfaced more than the
first (`campaigns[0]`, hardcoded in every render path). This was flagged
as a known gap in Part 8 prior to this session. Fixing it was pulled
forward from Part 17 §3 (Add/Remove Campaign UI) ahead of its original
position in the build order, because the planned left-sidebar layout work
depends on Campaign's real multi-campaign shape.

**Campaign dropdown** (`#campSelect`, single `<select>` — minimalist
choice over cards or tabs, confirmed explicitly with Aadi over those
alternatives):
- One `<option>` per existing campaign: `{id} — {category} · £{cpm} CPM`
  (+ `(paused)` suffix if inactive)
- Final option: `+ Add new campaign`
- `onchange="selectCampaign(this.value)"` re-renders `#campBody` for the
  selected campaign, or the new-campaign creation form
- Auto-selects the first campaign in the list on initial load

**Selecting an existing campaign** renders `#campBody` scoped to that
campaign's `id` (replacing the old global `CAMP_ID` singleton):
- **Settings** — CPM, daily/total budget, keywords, matching description,
  active/paused, dirty-flag guarded (`onfocus="settingsDirty=true"`,
  unchanged behavior from Session 10, now keyed per-campaign)
- **AI Creative Studio** — **moved inside Campaign this session,
  reversing the Session 10 decision** ("Creative Studio sits ABOVE
  Campaign section — drafting tool → feeds into live bank", documented in
  SESSION_LOG.md Session 10 and the original structural diagram). New
  decision, explicit from Aadi: "creative studio should be under each
  campaign and once they generate variants it gets added to the
  variants." 3 ideas in, 2 fact-led + 1 promo out — same Haiku
  prompt/safety model as before (Part 7, unchanged). "Add to my variants"
  now writes directly into the SELECTED campaign's variant bank via
  `POST /admin/campaign`, never a platform-wide pool.
- **Ad variants** — variant bank for the selected campaign only
  (view/edit/remove, min-5 floor enforced on removal, unchanged UI)
- **Recent activity** — `recentMatches` filtered to the selected
  `campaignId` specifically (new `campaignId` query param added to
  `GET /dashboard?view=advertiser` this session — narrows the existing
  advId-level filter further; falls back to advertiser-wide scope if the
  param is absent or doesn't belong to this advId, a security boundary so
  a crafted `campaignId` can't leak another advertiser's activity)
- **Delete campaign** button (red, confirm dialog) — calls the
  already-existing `POST /admin/campaign/delete` (built Session 4, never
  had a UI button until now)

**Selecting "+ Add new campaign"** renders a creation flow, same visual
shape as the Settings/Creative Studio/Variants stack above but unsaved:
- Blank form: category (finance/tech dropdown), CPM, daily/total budget,
  keywords, matching description
- AI Creative Studio works immediately, but "Add to my variants" and "Add
  a creative" write to a browser-side `stagedVariants` array in memory,
  NOT to KV — there's no campaign `id` yet to attach them to
- **Staged variants list** with a live `(N/5 minimum)` counter, each row
  removable before save
- **[Create campaign]** button — disabled until 5+ variants are staged
  (matches the existing removal floor, confirmed explicitly with Aadi).
  On click: computes the next free `camp_NNN` ID from currently-loaded
  campaign IDs client-side, then `POST /admin/campaign` with the full
  payload including staged variants — reuses the existing endpoint
  unchanged (it already handles create-or-update transparently; no new
  backend endpoint was needed). On success, the new campaign appears in
  the dropdown and becomes selected.

### ANALYTICS page (`/advertiser/{slug}/analytics`)

#### Section 1: Spend Sparkline
- Unchanged from Session 10. Still SIMULATED daily variance, not a real
  historical series — open issue, see Part 16.

#### Section 2: Campaign Performance Table
- Columns: Page | **Campaign** | Variant served | Method | Last crawl
- **Campaign column added this session** (confirmed explicitly with
  Aadi) — with multiple campaigns now visible per advertiser, rows were
  previously indistinguishable. Looks up
  `camps.find(c => c.id === p.servingId)` and renders the campaign `id`
  in monospace, or `—` if nothing is currently serving that page.
- Aggregated across ALL campaigns — this is the cross-campaign rollup;
  per-campaign detail lives in the Dashboard page's Campaign dropdown.

#### Section 3: Recent Activity
- Unchanged in shape — advertiser-wide (all campaigns pooled), last 10
  entries. This is deliberately a DIFFERENT scope from the new
  per-campaign Recent Activity living inside the Dashboard page's Campaign
  section — one is "everything happening for this advertiser," the other
  is "everything happening for this one campaign I'm looking at." Both
  intentional, not a duplication.

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

### Missing operations — RESOLVED Session 11
- ~~Add Campaign UI~~ — ✅ built (Dashboard page Campaign dropdown, "+ Add
  new campaign" option). See Part 4 and Part 17 §3.
- ~~Remove Campaign UI~~ — ✅ built (Delete campaign button in the
  selected campaign's Settings). See Part 4 and Part 17 §3.
- ~~Campaign list view~~ — ✅ built (the dropdown itself IS the list/switch
  UI — every campaign for this `advId` is enumerated as an option).

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

### Current routing (Session 11 — built)
| URL | What | Handler |
|-----|------|---------|
| `/ui` | Chooser ONLY (3 links: Advertiser/Publisher/Admin) | dashboard-ui.js |
| `/admin/dashboard` | Full operator dashboard (3 tabs, unsplit — banner notes split pending) | dashboard-ui.js |
| `/admin/analytics` | Same as above — content split not yet built (Part 6) | dashboard-ui.js |
| `/advertiser` | List of advertisers, links to `/dashboard` | dashboard-ui.js |
| `/advertiser/{slug}/dashboard` | Scoped advertiser portal — operational (Campaign dropdown, settings, Creative Studio, variants) | dashboard-ui.js |
| `/advertiser/{slug}/analytics` | Scoped advertiser portal — performance (sparkline, campaign performance table incl. Campaign column, recent activity) | dashboard-ui.js |
| `/publisher` | List of publishers, links to `/dashboard` | dashboard-ui.js |
| `/publisher/{slug}/dashboard` | Scoped publisher portal — operational (earnings, serving by page) | dashboard-ui.js |
| `/publisher/{slug}/analytics` | Scoped publisher portal — performance (recent activity only; thin until Part 17 §2 Ad Unit/Placement lands) | dashboard-ui.js |
| Unknown slug | 404 page, links back to `/advertiser` or `/publisher` | dashboard-ui.js |

All slug + dashboard/analytics routes anchored with `^...$` in vercel.json.
`view` (dashboard/analytics) and `slug` are both passed as query params via
`dest` rewrites — NOT parsed from `req.url` path segments, since Vercel's
legacy `routes`-array `dest` rewrite behavior for `req.url` inside the
handler isn't reliably verifiable from outside a live deploy. Matches the
proven convention from the original `/ui/advertiser/{slug}` route.

**Known shadowing bug found and fixed during this build:** `^/dashboard$`
(the JSON data API route) was previously unanchored as `/dashboard`, which
would have substring-matched `/admin/dashboard`, `/advertiser/{slug}/
dashboard`, and `/publisher/{slug}/dashboard` — silently routing all of
them to the JSON API instead of the UI. Caught via a route-matching
simulation before deploy. Anchored to `^/dashboard$`.

### What was NOT built this session
The admin portal's actual CONTENT split (Part 6's proposed Dashboard vs
Analytics section lists) — only the URLs exist. Both `/admin/dashboard`
and `/admin/analytics` currently serve the identical unsplit 3-tab view,
with a visible banner stating the redesign is planned. This is intentional
— flagged explicitly rather than silently served as if finished.

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

### 1. URL routing redesign — ✅ DONE (Session 11)
**What:** Drop `/ui` prefix, split into dashboard + analytics pages.
**New routes (live):**
```
/advertiser/{slug}/dashboard    → dashboard-ui.js (operational)
/advertiser/{slug}/analytics    → dashboard-ui.js (performance)
/publisher/{slug}/dashboard     → dashboard-ui.js (operational)
/publisher/{slug}/analytics     → dashboard-ui.js (performance)
/admin/dashboard                → dashboard-ui.js (unsplit content, banner notes split pending)
/admin/analytics                → dashboard-ui.js (unsplit content, banner notes split pending)
```
`/ui` retained as the chooser ONLY (confirmed explicitly with Aadi — all
other `/ui/*` routes removed, no parallel-running period, cut over in one
deploy). See Part 13 for full routing table and the `/dashboard` route
shadowing bug found and fixed during this build.
**Impact:** advertiser portal's single page split into Dashboard (cards +
Campaign — see Part 4, Campaign now also contains the per-campaign
Creative Studio after the Session 11 relocation) and Analytics (sparkline
+ performance table with new Campaign column + recent activity).
**NOT done:** admin portal's actual section-content split (Part 6) —
routing exists, content is identical on both URLs.

### 2. Publisher-side Ad Unit / Placement formalization
**What:** Turn hardcoded `PUBLISHER_PAGES`/`CATEGORY_PUBLISHERS` into real schemas.
**Schema:** `adUnits: [{ id, url, category, pubId, lastCrawl, fillStatus }]`
**Where:** Move from `admin.js` constants to `config.js` and/or KV.
**Publisher portal change:** replace the simple "by page" table with an Ad Unit
inventory view, grouped by Placement.
**Admin portal change:** add cross-publisher Ad Unit overview table.

### 3. Add Campaign / Remove Campaign — ✅ DONE (Session 11, pulled forward)
**Why pulled forward:** originally scheduled after §1/§2/§4/§5. Pulled
forward ahead of the left-sidebar layout work (raised by Aadi outside this
spec — not previously documented anywhere) because the sidebar's Campaign
section design depended on knowing the real (multi-campaign) shape first.
**Add Campaign (as built):**
- Campaign dropdown at top of the Dashboard page's Campaign section, final
  option `+ Add new campaign` — confirmed as a single `<select>` over
  cards/tabs alternatives (Aadi: "minimalism for now")
- Form fields: category (dropdown: finance/tech), cpmGBP, budgetDailyGBP,
  budgetTotalGBP, keywords, matchingDescription — id computed client-side
  (next free `camp_NNN`), not server-generated
- **5+ staged variants required before the Create campaign button enables**
  (confirmed explicitly — matches the existing removal floor)
- On submit: `POST /admin/campaign` (existing endpoint, unchanged — already
  handled create-or-update, no new backend work needed)
- After creation: dropdown refreshes, new campaign becomes selected (no
  page redirect — stays on the same Dashboard page)
**Remove Campaign (as built):**
- Button inside the selected campaign's Settings sub-section, red/destructive
- Confirmation dialog (`confirm()`) showing the campaign ID
- On confirm: `POST /admin/campaign/delete` (existing endpoint from Session
  4, never had a UI button before this)
- After deletion: campaign list reloads, no campaign selected by default

### 4. Variant `focus` tag
**What:** Optional free-text tag on each variant for organizational grouping.
**Schema change:** variant `{ id, angle, text, focus? }`
**UI change:** show focus tag as a small pill/badge on each variant row.
  Add a focus input to Add Creative and Edit Variant forms.
**Matching change:** NONE — purely organizational, does not affect The Matcher.

### 5. Creative Studio quality improvements
**Context update (Session 11):** Creative Studio now lives inside the
Campaign section, scoped per-campaign (see Part 4) — this section's fixes
still apply to the same underlying Haiku prompt/safety model in
`api/admin.js` (Part 7), unaffected by where the UI surfaces it.
**Priority fixes (not yet built):**
- Fuzzy number matching in `outputTraceable()` (0.15% ≈ 15 basis points)
- Stronger honesty-test enforcement (reject vague filler more aggressively)
- Consider page-context input (let advertiser optionally paste a target page
  URL so Haiku can tailor tone to that specific article)

### 7. Left-side persistent sidebar (raised mid-Session 11, NOT YET BUILT)
**Status:** real requirement, confirmed with Aadi, but not previously
written down anywhere this spec or any prior session log could find —
discovered only when Aadi reacted to the deployed §1 routing redesign
("I wanted a layout where the dashboard, analytics etc stay on the left,
like discussed" / "a persistent sidebar with sections like overview,
campaigns, creative/settings"). Searched past chats and this spec
specifically for prior mention before treating it as new scope; found
none — noting that explicitly so a future session doesn't assume it was
missed rather than newly introduced.
**Confirmed sections:** Overview, Campaign, Creative studio, Analytics.
**Note:** "Creative studio" as a sidebar item does NOT mean it's a
top-level page separate from Campaign — Aadi confirmed Creative Studio
"should be under each new campaign," i.e. it's part of the Campaign
section's content, not a sibling of it. The sidebar item list and the
actual page/section boundaries are two different things; don't conflate
a nav label with a routing boundary when building this.
**Open decision, NOT yet resolved:** separate page per sidebar section
(own URL, lighter loads) vs. one page with the sidebar scrolling/revealing
sections (single URL, simpler, heavier). Shown to Aadi as a visual
comparison; not yet chosen as of this entry.
**Likely motivation for the slow-analytics complaint that surfaced this:**
the Analytics page currently does one `fetch` for the FULL advertiser
payload (all campaigns' impressions, spend, variant breakdowns, etc.) just
to render three relatively simple sections. A separate-page-per-section
sidebar would naturally fix this by only fetching what each section needs
— worth keeping in mind when the layout choice above gets made.

### 6. Prompt-Level Visibility Monitoring (researched Session 10, NOT BUILT)

**The gap this fills:** Today we measure Stage A of a two-stage funnel —
"did an AI crawler visit the page and did we serve a variant?" We have
ZERO visibility into Stage B — "did that injected content actually make
it into the AI's final answer when a real user asked a real question?"
A crawl can be triggered by any of thousands of possible user prompts;
we cannot connect a specific crawl to a specific question, and we cannot
see whether the AI's answer to ANY question ends up naming our advertiser.

**Competitive context:** Oasy (our direct competitor) publishes case
studies built entirely around this Stage B measurement — e.g. "Amsterdam
Food Tours was named in 52.6% of AI answers when their publisher was
cited vs 16.6% when it wasn't, a 3.2x lift" and "Glider Insurance went
from 0% to 33% AI-answer visibility in 26 days." These numbers come from
an independent third-party monitor (Promptwatch.com), not Oasy's own
dashboard — explicitly to pre-empt the "grading your own homework"
objection. This is a meaningfully more persuasive sales artifact than
anything our current dashboard can produce (we can only say "your ad was
injected N times"; they can say "your brand went from invisible to
recommended one time in three").

**How this measurement actually works (no privileged AI-company access
required):** The monitoring platforms are NOT getting internal data from
OpenAI/Perplexity/Google. They maintain a fixed list of prompts, send
those exact prompts to each AI product's own public-facing surface
(API or web app) on a repeating schedule, and parse the response text
for brand mentions plus, where the product exposes them, the visible
citation/source list (Perplexity and ChatGPT Browse both show clickable
source links — this is public, visible, parseable from the API response,
not inferred). It is disciplined, repeated, automated querying of the
public product — the same thing a human could do by hand, just scheduled
and logged.

**Proposed architecture for our own version:**

```
New subsystem — runs on its own schedule, separate from The Matcher.
Does NOT touch injection, auction, or variant selection.

1. PROMPT DEFINITION (per campaign, manual/considered — not automated
   from keywords, since prompt quality matters more than quantity).
   Stored as new campaign field: monitoredPrompts: [
     "best commission-free investing platform UK",
     "cheapest stocks and shares ISA"
   ]
   Oasy's own case studies show: 2-10 well-chosen high-intent commercial
   prompts produce meaningful, stable measurement. More isn't always better
   — broad "explain the system" prompts barely moved in their data; narrow,
   high-commercial-intent prompts moved the most.

2. SCHEDULED QUERY JOB (new, e.g. api/visibility-check.js — BUT WE HAVE
   ONLY 2 FREE FUNCTION SLOTS, so this may need to fold into an existing
   file, likely precompute.js or a new lightweight cron-triggered handler)
   - Runs daily (Vercel Cron or external scheduler)
   - For each campaign with monitoredPrompts defined:
       For each prompt:
         Query Perplexity API (has a stable, documented API + citations)
         Query other platforms WHERE FEASIBLE (see constraints below)
         Parse response text for brand name mention (case-insensitive)
         Parse citations/sources list for publisher URL presence
         Store result

3. STORAGE (new KV pattern)
   visibility:{campaignId}:{promptHash}:{date} → 
     { mentioned: bool, citedPublisher: bool, sentiment?: number, rawAnswer: string }
   
   Mirrors Oasy's own split: track BOTH whether the brand was mentioned
   AND whether our publisher's page was in the citation list for that
   response. This lets us compute our own version of their headline
   number: "mention rate when our publisher was cited vs when it wasn't."

4. DASHBOARD SECTION (new, in advertiser portal — likely under Analytics
   once the dashboard/analytics split is built, see Proposed Change #1)
   - Per-prompt visibility trend (line chart, daily mention rate)
   - "Cited vs not cited" split, mirroring Oasy's methodology exactly
   - Peak visibility, current visibility, days-to-first-lift stats
   - Per-prompt breakdown table (which prompts are working, which aren't)
```

**Real constraints — must be scoped before building, not discovered during:**

- **API cost.** This is a recurring, ongoing cost (daily queries × prompts ×
  platforms × advertisers), structurally different from the occasional
  Haiku call we make today. 14 advertisers × 5 prompts × 1 platform × daily
  = 70 API calls/day minimum just for Perplexity; multiply by however many
  platforms we add. Needs real budget scoping against Anthropic/Perplexity
  API pricing before committing to a build.

- **Not all platforms have equivalent public APIs.** Perplexity has a
  documented API with citations exposed. ChatGPT's API does NOT browse the
  web the same way the consumer ChatGPT Browse product does by default —
  needs verification whether a `web_search`-enabled API call produces
  genuinely comparable citation/mention behaviour to what a real user sees
  in the consumer app, or whether this realistically only works well for
  Perplexity-style products first.

- **This is a genuinely separate subsystem, not an extension of The
  Matcher.** Different schedule (daily, not per-crawl), different target
  (external AI products' public APIs, not our own Worker), different
  storage pattern, different dashboard surface. Should be scoped and built
  as its own piece of work, not bolted onto an existing file.

- **Prompt selection requires human judgement per campaign**, similar to
  how Creative Studio inputs require a real stat — there's no shortcut
  to "good prompts," and bad prompt selection produces a measurement that
  looks broken (flat 0% lines) even if the underlying injection strategy
  is working fine on the prompts that matter.

**Recommended path before full build:** a small, cheap pilot — ONE
advertiser, 2-3 hand-picked prompts, Perplexity only — to validate the
mechanism (can we reliably parse mentions + citations from Perplexity's
API response) before committing to the full scheduled, multi-advertiser,
multi-platform system. This mirrors how Session 9-10's CPM testing
validated the core data-led-vs-promo insight cheaply before scaling it
across all 14 campaigns.

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
