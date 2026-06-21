# PLATFORM_STRUCTURE_SPEC.md — boop Platform Architecture Reference

> **This is the canonical reference for the entire platform.**
> Read this FIRST before touching any code. Every term, every pipeline stage,
> every UI section is defined here. If code or other docs conflict with this
> file, THIS FILE IS CORRECT — flag and fix the conflict.
>
> Written: Session 10 (2026-06-21). Audited against live codebase, not memory.

---

## 1. What boop Is

A server-side AI advertising platform that monetises AI crawler traffic to
publisher websites. When an AI crawler (Perplexity, ChatGPT Browse, Grok, etc.)
visits a publisher's page, the platform detects it, injects a sponsored text
paragraph into the HTML response, and charges the advertiser CPM. Human visitors
see the original, unmodified page.

**Core insight (validated):** ad copy containing specific statistics from named
authoritative third-party sources (HMRC, Pensions Policy Institute, NCSC)
gets absorbed by AI systems as editorial fact and cited in their responses.
Ad copy with brand-as-subject benefit claims, CTA verbs ("Open a...", "Try..."),
or disclaimer language ("Capital at risk") gets flagged as "a promotional section"
and summarised around or excluded. This is the platform's USP — helping
advertisers write copy that AI systems cite rather than filter.

---

## 2. Deployments & Infrastructure

| What | Where |
|------|-------|
| Platform (main) | `testbot-two-psi.vercel.app` (Vercel Hobby plan) |
| GitHub repo | `github.com/aadithyask99-boop/testbot` (main branch) |
| Database | Upstash Redis (pay-as-you-go, via KV_REST_API_URL/TOKEN env vars) |
| AI model | Claude Haiku (`claude-haiku-4-5`) for matching + variant selection |
| Finance Weekly (publisher) | `finance-weekly.vercel.app` (origin), `finance-weekly-worker.projectatlas.workers.dev` (Worker proxy) |
| Tech Briefing (publisher) | `tech-briefing-tau.vercel.app` (origin), `tech-briefing-worker.projectatlas.workers.dev` (Worker proxy) |
| Serverless functions | 10/12 used (Hobby plan limit is 12) |

---

## 3. The Matcher — Our Auction Mechanism

**Formal name:** Relevance-Weighted Auction with Dynamic Creative Resolution.
**Casual name:** "The Matcher."

This is NOT a standard waterfall or header bidding system. It's a two-phase,
content-aware mechanism that has no exact industry equivalent:

- **Phase A** (page classification + campaign auction) — can be precomputed
- **Phase B** (variant selection from the winner's bank) — separately cached, NOT precomputed

### Phase A: Page Classification + Relevance-Weighted Auction

**What it answers:** "Which advertiser's campaign wins this page?"

Implemented in `lib/relevance.js` → `runMatch(pageSignals)`.

Input: `pageSignals` = `{ url, title, metaDescription, firstParagraph, bodySample, publisherCategory? }`
(These page signals are extracted by the Cloudflare Worker from the publisher's raw HTML —
title from `<title>`, meta description from `<meta name="description">`, body text stripped
of tags and truncated to ~1500 chars.)

```
Stage 0 — Cache check
  Key: match:{sha256(url)}, 24h TTL
  If hit: skip straight to the cached result (category + winning campaign)
  If miss: proceed through stages 1-5

Stage 1 — Publisher tag
  If the Worker/publisher explicitly declares a category (e.g. "finance"),
  trust it and skip keyword/Haiku classification entirely.
  Currently: Workers pass publisherCategory from their config.

Stage 2 — Keyword scoring
  Weighted taxonomy match against title + metaDescription + firstParagraph.
  Two tiers per category:
    Finance tier 1 (weight 10): isa, pension, stocks, shares, etf, dividend...
    Finance tier 2 (weight 6): investment, savings, fund, trading...
    Tech tier 1 (weight 10): api, saas, kubernetes, vpn, cybersecurity...
    Tech tier 2 (weight 6): software, developer, cloud, startup...
  Produces a 0-1 score. If score >= 0.5: confident classification, skip Haiku.

Stage 3 — Haiku classification (LLM fallback)
  ONLY fires if keyword score < 0.5 (saves cost — ~£0.00003/call).
  Haiku reads url + title + metaDescription + bodySample (~1500 chars).
  Returns one word: "finance", "tech", or "other".
  If "other" or Haiku fails: no ad served on this page.
  Fallback if Haiku rate-limited/errors: use the keyword result as-is.

Stage 4 — Per-campaign relevance scoring + filtering
  For each active campaign in the matched category:
    - Score campaign's keywords against the page text (0-1 relevance score)
    - Haiku also evaluates relevance (pass/fail filter for borderline cases)
    - Drop any campaign scoring below RELEVANCE_THRESHOLD (currently 0.2)

Stage 5 — Relevance-Weighted Auction
  Surviving campaigns compared SIMULTANEOUSLY (not sequential waterfall):
    effectiveCPM = cpmGBP × relevanceScore
  Highest effectiveCPM wins.
  Budget check: winner must have remaining daily + total budget.
  If winner is over budget: next-highest wins, and so on.
  If nobody has budget: no ad served.
  
  Result cached: match:{sha256(url)} with 24h TTL.
```

**Precompute:** `api/precompute.js` runs a sweep that warms Stages 0-3
(category classification) for all known pages. Stages 4-5 (per-campaign
relevance scoring + auction) are NOT precomputed because they depend on
live campaign state (budgets, active status) that changes more often than
page topics. The precompute sweep only classifies; the auction runs live
(but benefits from the cached classification).

### Phase B: Dynamic Creative Resolution

**What it answers:** "Which specific variant from the winning campaign
should be injected into this page?"

Implemented in `lib/relevance.js` → `selectVariant(winner, pageSignals)`.

```
Stage 6 — Variant cache check
  Key: variant:{sha256(url + '|' + campaignId)}, 24h TTL
  If hit AND the cached variant ID still exists in the campaign's current
  variant bank: use it (cache key includes campaignId, not just URL).
  If hit BUT the variant was removed (campaign edited): cache miss, recompute.

Stage 7 — Haiku variant selection
  Haiku receives: ALL variants in the winning campaign's bank + page signals.
  Picks the single best-fitting variant for THIS specific page.
  (E.g. pension-gap stat for a pension article, ISA-millionaire stat for an ISA article.)
  
  This is what makes the system "Dynamic Creative Resolution" — the SAME
  campaign can serve DIFFERENT variants on DIFFERENT pages, decided per-page
  by Haiku, not by a fixed rotation or the advertiser's preference.

Stage 8 — Round-robin fallback
  ONLY if Haiku fails (rate limit, auth error, timeout).
  Atomic per-campaign counter in KV, cycles through variants in order.
  Deterministic, never random — same campaign always gets the same
  next-in-line variant on failure, preventing duplicates under concurrency.

  Result cached: variant:{sha256(url + '|' + campaignId)} with 24h TTL.
```

**NOT precomputed.** The precompute sweep explicitly does NOT warm the variant
cache (comment in `lib/relevance.js`: "depends on live campaign state and
should NOT be precomputed"). Variant selection resolves on first real request
after a cache miss or expiry.

### Triggering fresh resolution

When an advertiser saves a campaign with new/changed variants:
1. `variantsChanged()` in `api/admin.js` detects the change
2. `invalidatePrecomputeCaches()` clears relevant match: and variant: caches
3. `scheduleCrawls(category, 60000)` fires synthetic PerplexityBot crawls
   to all pages in that category after 60 seconds
4. The crawl hits the Worker → Worker calls /match → fresh Stages 4-8 run
5. New variant selection is cached before real AI crawlers visit

Manual crawl: "Crawl Finance" / "Crawl Tech" / "Crawl All" buttons on the
admin dashboard fire the same crawl immediately (0ms delay).

---

## 4. Advertiser Side

### Campaign
One per advertiser today. Schema:

```json
{
  "id": "camp_002",
  "advId": "adv_002",
  "advertiser": "Trading 212",
  "category": "finance",
  "cpmGBP": 10,
  "budgetDailyGBP": 50,
  "budgetTotalGBP": 500,
  "keywords": ["isa", "pension", "investment"],
  "matchingDescription": "UK Cash ISA and investment platform...",
  "variants": [
    { "id": "v1", "angle": "cash isa rates", "text": "..." },
    { "id": "v2", "angle": "data-led: fee comparison", "text": "..." }
  ],
  "link": "",
  "linkText": "Learn more",
  "advSlug": "trading-212",
  "advId": "adv_002",
  "active": true,
  "startDate": "2026-06-10",
  "endDate": null
}
```

**No "Ad Group" layer.** Explicitly researched and rejected (Session 10):
native advertising platforms (Taboola, Teads/Outbrain), our closest real-world
analogue, use flat Campaign→Creative, not AdWords' Campaign→Ad Group→Ad.
AdWords' 2026 best practice also moved away from hyper-granular grouping.
Do NOT reintroduce Ad Groups without re-reading the research notes in
this session's conversation transcript.

### Variant Bank
The flat list of ad copy options, 5-15 per campaign (enforced by
`config.variantLimits`).

### Variant
`{ id, angle, text, focus? }`

- **id** — stable across saves. `normalizeVariants()` preserves existing IDs,
  only assigns new ones (v7, v8...) to genuinely new variants. This was a
  Session 10 bug fix — the old version reassigned v1..vN by array position on
  every save, breaking Remove and Edit. DO NOT REGRESS.
- **angle** — short internal label (e.g. "data-led: fee comparison"). Not
  shown to end readers.
- **text** — the actual ad copy, max 280 characters, no em dashes (enforced
  via Creative Studio prompt instruction + server-side regex backstop in
  `admin.js`).
- **focus** — OPTIONAL free-text tag (e.g. "pension", "first-time-buyer").
  Organisational only — does NOT change matching logic. NOT YET IMPLEMENTED
  in code; agreed in Session 10 as the right lightweight alternative to
  Ad Groups.

### AI Creative Studio
Standalone copywriting tool, fully SEPARATE from the live matching pipeline.
Does NOT touch the auction, precompute, or variant selection.

**How it works:**
1. Advertiser enters 3 rough ideas (can be phrases, sentences, or full drafts)
2. INPUT GATE: at least 2 of 3 must contain a real figure (regex check for
   digits, million/billion/thousand). Refuses BEFORE calling Haiku if not met.
   The tool will NEVER invent data — this gate enforces it.
3. Haiku generates: 2 fact-led variants (journalist style, third-party
   attribution, no brand-as-subject benefit claims) + 1 honest promo variant.
4. OUTPUT SAFETY CHECK: every number in Haiku's output must trace back to a
   number in the input (or be a year like 2026, or be part of the brand name
   like "Trading 212"). Any variant with an untraceable figure is DROPPED
   before being shown.
5. Em dash backstop: server-side regex strips any em dashes Haiku produces
   despite the prompt instruction.
6. Advertiser reviews output, clicks "Add to my variants" per-variant to add
   individually to their live Variant Bank. Nothing from Creative Studio is
   live until that explicit action.

**Endpoint:** `POST /admin/creative-studio`
**Location in UI:** sits ABOVE the Campaign section as a separate drafting tool.

### Campaign management operations

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Create/update campaign | `POST /admin/campaign` | Full campaign JSON in body |
| Pause/resume | `POST /admin/campaign/pause` | `{ id, active: bool }` |
| Delete | `POST /admin/campaign/delete` | `{ id }` |
| List all | `GET /admin` | Returns all campaigns with spend data |
| Seed demo | `POST /admin/seed` | Resets to default Vanguard demo |
| Reset stats | `POST /admin/reset-stats` | Clears all impression/click counters |
| Reindex | `POST /admin/reindex` | Rebuilds category index lists |
| Manual crawl | `POST /admin/crawl` | `{ category: 'finance'|'tech'|'all' }` |
| Creative Studio | `POST /admin/creative-studio` | `{ advertiser, ideas: [3 strings] }` |

### Advertiser portal sections (in order, as rendered)

URL: `/ui/advertiser/{slug}` (e.g. `/ui/advertiser/trading-212`)

1. **Summary cards** — Status (active/paused + CPM), Total impressions
   (+ viewable count), Total spend (+ vCPM), Daily budget used (+ warning
   at ≥80%)
2. **Spend sparkline** — 7-day bar chart (currently simulated variance,
   not real daily series)
3. **Campaign performance table** — per-page serving: which pages this
   advertiser is winning, which variant is being served, match method,
   last crawl time
4. **AI Creative Studio** — the drafting tool (see above)
5. **Campaign section** containing:
   - **Settings** — CPM, daily budget, total budget, active/paused toggle,
     keywords (comma-separated), matching description. Editable + Save button.
     Dirty-flag guard prevents auto-refresh from clobbering in-progress edits.
   - **Add a creative** — manual single-variant entry (angle + text + char
     counter). Saves trigger 60s auto-crawl.
   - **Ad variants** — the live Variant Bank list. Each variant shows:
     angle, impression count + %, text, TOP PERFORMER badge on highest-%.
     Edit button (inline form: editable angle + text + Save/Cancel).
     Remove button (confirm dialog, enforces min-5 floor).
6. **Recent activity** — crawl log scoped to this advId. Shows: which AI
   platform visited, which page, whether this advertiser won or lost, which
   variant was served, timestamp.

---

## 5. Publisher Side

### Publisher
`{ pubId, name, slug, domains[], sitemapUrl, token, floorCPM, active }`

Two publishers today:
- Finance Weekly (`pub_001`, slug `financeweekly`)
- Tech Briefing (`pub_002`, slug `techbriefing`)

Each publisher has two domains: the origin (Vercel-hosted demo content) and
the Cloudflare Worker proxy (what real AI crawlers hit).

### Ad Unit (PLANNED — not yet in code as a formal schema)
One per page/article. Currently hardcoded as `PUBLISHER_PAGES` in `admin.js`.
Carries: url, category, pubId, fill status, last crawl time.
Formalising this into a real `adUnits[]` array per publisher is planned.

### Placement (PLANNED — not yet in code as a formal schema)
Named grouping of Ad Units (e.g. "Finance Weekly — Finance vertical").
Currently implicit via `CATEGORY_PUBLISHERS` map. Formalising this gives
publishers a real inventory view.

### Publisher portal sections (in order, as rendered)

URL: `/ui/publisher/{slug}` (e.g. `/ui/publisher/financeweekly`)

1. **Earnings/traffic cards** — Your earnings (80% share + today's earnings),
   Gross ad spend, vCPM, Impressions (total + today), Fill rate (served / bot visits)
2. **Ad serving by page** — per-Ad-Unit table: page URL, what's currently
   serving (advertiser + CPM + variant angle), last platform, last crawl time
3. **Recent activity** — crawl log scoped to this pubId. Shows: which AI
   platform visited, which page, what was served, timestamp.

---

## 6. Revenue Model

```
Advertiser pays:     stated CPM (gross)
Publisher receives:  80% of gross CPM × impressions / 1000
Platform receives:   20% of gross CPM × impressions / 1000

Training impressions (GPTBot, ClaudeBot) billed at 30% of campaign CPM
(lower commercial value, delayed effect — 6-18 month lag to model training).

Revenue stored as integer tenths-of-pence (×1000) in KV for atomicity.
KV keys: revenue:gross:total, revenue:platform:total,
         revenue:publisher:{pubId}:total, revenue:advertiser:{advId}:total
         (plus daily variants with :date:{YYYY-MM-DD} suffix)
```

---

## 7. Portal Routing (current)

| URL | What |
|-----|------|
| `/ui` | Chooser page — 3 links: Advertiser / Publisher / Admin |
| `/ui/admin` | Full operator dashboard (unchanged from pre-portal work) |
| `/ui/advertiser` | List of all 15 advertisers |
| `/ui/advertiser/{slug}` | Scoped advertiser portal |
| `/ui/publisher` | List of 2 publishers |
| `/ui/publisher/{slug}` | Scoped publisher portal |
| Unknown slug | 404 page |

**Planned routing change (not yet built):**
Drop the `/ui` prefix entirely. Proposed scheme:
```
/advertiser/{slug}/dashboard   — operational (settings, variants, Creative Studio)
/advertiser/{slug}/analytics   — deeper performance data (spend trends, variant breakdown)
/publisher/{slug}/dashboard    — operational (earnings, serving status)
/publisher/{slug}/analytics    — traffic trends, crawl activity
/admin                         — full cross-everything operator view
```
This separates "dashboard" (day-to-day operations) from "analytics" (deeper
performance data that doesn't need to load every time). NOT YET BUILT.

---

## 8. Serverless Function Slots (10/12 used)

| # | File | Purpose |
|---|------|---------|
| 1 | api/index.js | Main handler: bot detection → creative fetch → injection → impression logging |
| 2 | api/admin.js | Campaign CRUD, Creative Studio, manual crawl, seed, reindex, reset-stats |
| 3 | api/dashboard.js | Analytics API: 3 views (operator, advertiser, publisher) with scoping |
| 4 | api/dashboard-ui.js | Visual UI: chooser, admin, scoped advertiser/publisher portals |
| 5 | api/click.js | /click redirect + ad click tracking |
| 6 | api/sdk.js | Client-side publisher snippet (headless browser detection — secondary to server-side) |
| 7 | api/utils.js | /health, /robots.txt, /sitemap.xml, /ping (consolidated) |
| 8 | api/match.js | /match endpoint for Worker calls (contextual matching) |
| 9 | api/precompute.js | Sweep: warms category classification cache for known pages |
| 10 | api/impression.js | /impression endpoint: revenue tracking with 80/20 split |
| — | (2 free) | Reserved for: api/publishers.js (publisher management), 1 spare |

**HARD LIMIT: 12 functions on Vercel Hobby. Never add a file without checking.**

---

## 9. Bot Detection

Implemented in `lib/detector.js` (40+ crawler UA patterns), `lib/combined-detector.js`
(3-layer: UA match → behavioural scoring → anonymous crawler detection),
`lib/behavioural.js` (header signal scoring).

**Reliably detected:** Perplexity, ChatGPT Browse, GPTBot, ClaudeBot, Bingbot,
Meta-ExternalFetcher, Google-Agent, xAI-Bot, DuckAssistBot, MistralAI, and ~30 more.

**Anonymous detection (no published UA):** DeepSeek. Chrome UA + missing all three
browser-proof headers (Accept-Language, sec-ch-ua, sec-fetch-mode) = 75% confidence.

**Excluded from injection (cloakingRisk: true):** Googlebot, GoogleOther ONLY.
Serving different content to Google's crawler is a cloaking violation.
Perplexity/ChatGPT/Grok are NOT search engines — no cloaking policy applies.

**Undetectable:** Grok's browse tool (spoofed iPhone Safari UA with full browser headers).
Gets the clean page on live search; gets injected content via xAI-Bot background indexing.

---

## 10. Cloudflare Worker (Publisher-Side Proxy)

Implemented in `worker/index.js`. See `WORKER_SDK_SPEC.md` for full design.

The Worker sits in front of a publisher's origin site. Flow:
1. Request arrives at Worker
2. Worker checks UA against BOT_PATTERNS
3. If human: fetch origin, return unmodified
4. If bot: fetch origin (using non-bot UA so origin serves clean page),
   call `/match` on the platform to get the winning campaign + variant,
   inject variant text as a plain `<p>` tag into the HTML,
   call `/impression` to log the impression and track revenue,
   return the modified HTML

**Two Workers deployed today:**
- `finance-weekly-worker.projectatlas.workers.dev` (proxies Finance Weekly)
- `tech-briefing-worker.projectatlas.workers.dev` (proxies Tech Briefing)

---

## 11. KV Data Schema (Upstash Redis)

```
campaign:{id}                         Object — full campaign data
campaigns:{category}                  Array of campaign IDs in that category

stats:impressions:total               Integer — all-time impression count
stats:impressions:date:{YYYY-MM-DD}   Integer — daily impressions
stats:impressions:type:{type}         Integer — by crawler type (retrieval/training)
stats:impressions:platform:{name}     Integer — by AI platform
stats:impressions:pub:{pubId}:total   Integer — per-publisher impressions
stats:impressions:pub:{pubId}:date:{} Integer — per-publisher daily
stats:bot_visits:total                Integer — all bot visits (including unserved)
stats:bot_served:total                Integer — bot visits that received an ad

impr:{type}:{campaignId}:{date}       Integer — per-campaign daily by type
impr:{type}:{campaignId}:total        Integer — per-campaign total by type

spend:daily:{campaignId}:{date}       Integer — campaign daily spend (tenths-of-pence)
spend:total:{campaignId}              Integer — campaign total spend (tenths-of-pence)

revenue:gross:total                   Integer — total gross revenue (tenths-of-pence)
revenue:platform:total                Integer — platform's 20% cut
revenue:publisher:{pubId}:total       Integer — publisher's 80% share
revenue:advertiser:{advId}:total      Integer — advertiser's total spend
(plus daily variants with :date:{YYYY-MM-DD} suffix for all revenue keys)

match:{sha256(url)}                   Object — cached category classification (24h TTL)
variant:{sha256(url|campaignId)}      Object — cached variant selection (24h TTL)
precompute:{sha256(url)}              Object — precompute sweep metadata

log:recent                            List (last 100) — bot impression log entries
log:clicks                            List (last 100) — publisher click log entries
log:adclicks                          List (last 100) — advertiser click log entries

session:click:{IP}                    String '1' with 300s TTL — click session dedup
```

---

## 12. What's Proven vs What's Demo

**Proven by real-world testing:**
- ChatGPT Browse, Perplexity, Grok, Claude, Gemini 2.5 Flash, Meta AI all
  surfaced injected content in their responses
- Data-led variants (with third-party stats) get cited as editorial fact;
  promo variants get flagged as "a promotional section" by ChatGPT
- Dynamic creative swap works — change confirmed within ~25 min (ChatGPT Browse)
- Weighted relevance auction: higher-relevance campaigns beat equal-CPM competitors
- Auto-crawl on variant save: new variants are pre-warmed before real bots visit

**Still demo/placeholder:**
- Publisher pages are hardcoded demo articles, not real publisher content
- No real advertiser/publisher auth — portal access is URL-based only
- Spend sparkline uses simulated data (no real daily spend series stored yet)
- No Add Campaign or Remove Campaign UI in the advertiser portal
- Creative Studio output quality is inconsistent (safety filter sometimes too aggressive)
- `api/sdk.js` is client-side only (headless browser detection) — secondary to server-side

---

## 13. Active Constraints

1. Vercel Hobby: 12 serverless function limit. Currently 10 used, 2 free.
2. No client-side injection for real crawlers — they don't execute JS.
3. Googlebot/GoogleOther must NEVER receive injected content (cloakingRisk flag).
4. `requestsPerMinute` always 1 in behavioural scoring — rate signal never fires.
5. One campaign per advertiser (schema allows multiple, UI assumes one).
6. Creative Studio's safety filter can be over-aggressive on certain inputs.

---

## 14. Cross-References

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Project brain — why each architectural decision was made |
| `CLAUDE.local.md` | Session-start protocol (what to read, what to check) |
| `CONTINUE.md` | Mistakes, learnings, hard-won knowledge across sessions |
| `HANDOVER.md` | Current task state, immediate next steps, bugs |
| `SESSION_LOG.md` | Historical record of what was built in each session |
| `VARIANT_BANK_SPEC.md` | Variant schema detail (Session 9-era) |
| `PRECOMPUTE_SPEC.md` | Precompute sweep mechanics |
| `WORKER_SDK_SPEC.md` | Cloudflare Worker design |
| `PLATFORM_STRUCTURE_SPEC.md` | THIS FILE — canonical naming + architecture |
