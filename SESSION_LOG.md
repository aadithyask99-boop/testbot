# SESSION LOG

Each session gets an entry here. Written by Claude at session end.
Format: session number, name, date, what was built/decided/learned.

---

## Session 1 — Understanding Oasy.ai Functionality
**Date:** 2026-06-09  
**Chat:** Claude.ai (claude.ai chat, not Claude Code)  
**Goal:** Research the competitor (Oasy.ai), understand the business model, build and deploy a working proof of concept.

**What was built:**
- Full bot detection engine (lib/detector.js, lib/combined-detector.js, lib/behavioural.js) covering 40+ AI crawlers
- HTML injection engine (lib/injector.js) — plain `<p>` tag, no fingerprints
- Main serverless handler (api/index.js) — bot path injects creative, human path clean
- Upstash Redis integration (lib/kv.js) with atomic hash operations
- Dynamic creative system — update via API, live within seconds
- Dashboard (api/dashboard.js + api/dashboard-ui.js) — three views, 5-second polling
- Click tracking (lib/referrer.js, api/click.js) — 14 AI platforms, Perplexity query extraction
- Publisher SDK placeholder (api/sdk.js)
- SEO infrastructure — robots.txt, sitemap.xml, Bing verification, IndexNow ping

**What was validated:**
- Injection confirmed working: ChatGPT Browse, Perplexity, Grok, Gemini 2.5 Flash, Meta AI, Claude
- Dynamic creative swap: Vanguard → Fidelity → Hargreaves Lansdown all confirmed
- ChatGPT Browse propagation: ~25 minutes from creative change to AI response update
- Dashboard impressions, clicks, CTR all logging correctly

**Key decisions made:**
- Revenue share: 80/20 (publisher/platform)
- Auction model: first-price CPM waterfall (not RTB)
- Ad categories: Finance and Tech
- Publisher floor price: per-publisher, not global
- CPM adjustable via advertiser panel
- Cloaking policy: Googlebot/GoogleOther excluded, Perplexity/ChatGPT/Grok fine
- Vercel Hobby: 12 function limit — consolidated to 7 functions

**Bugs fixed this session:**
- Revenue share 60/40 → 80/20
- Hardcoded CPM → uses currentCreative.cpmGBP
- Unique click race condition → kvHashIncr
- Duplicate Google-CloudVertexBot entry
- Relative /click URL → absolute via PLATFORM_URL
- editorial-note class → removed
- detectionThreshold → reads from config.js

**Where we stopped:**
- All 8 bugs fixed (bug 7 acknowledged, not fully fixed)
- Serverless functions consolidated: 7/12 used
- Project docs written: CLAUDE.md, CONTINUE.md, HANDOVER.md
- Ready to start Session 2: campaign schema + auction system

---

## Session 2 — Commercial Layer (Campaigns + Auction + Multi-page Demo)
**Date:** 2026-06-10  
**Chat:** Claude.ai  
**Goal:** Build the commercial layer on top of the working POC — campaign schema, real auction, multi-page demo so matching has something to match against.

**What was built:**
- Campaign schema with budgets, keywords, dates, slug, active flag (lib/config.js + api/admin.js)
- CPM waterfall auction in lib/auction.js: shuffle (random tiebreak) → sort by CPM desc → walk list checking daily and total budgets → first solvent campaign wins
- Per-campaign spend tracking with atomic HINCRBY (`spend:daily:{id}:{date}`, `spend:total:{id}`)
- Full admin endpoints: POST /admin/campaign (create/update), POST /admin/campaign/pause
- Dashboard rebuilt for multi-campaign: auction-ordered list, winner badge, per-campaign click drill-down, viewable impressions (retrieval only), vCPM
- Multi-page demo (lib/demo-pages.js) — 4 articles: best-isa-2026, pension-vs-isa, best-vpn-services, pasta-recipe — so matching has real distinct pages to choose between
- Reset-stats endpoint for clean testing (api/admin.js POST /admin/reset-stats)

**Key decisions made:**
- Random shuffle before CPM sort to handle equal-CPM ties (no deterministic tiebreak — gave us trouble later, see Session 4)
- Training impressions billed at 30% of retrieval CPM (encoded in dashboard revenue calc)
- The behavioural rate-signal (+30pts) explicitly removed from production path — UA detection + anonymous_crawler path handle the cases that matter
- Spend tracking lives on the campaign (not the creative) so future variants share spend
- Demo pages use a `publisherCategory` declarative override field — for future publisher tag UX

**Where we stopped:**
- Auction live across 4 demo pages
- 91 tests passing
- 7/12 functions still
- Ready for Session 3: contextual matching layer

---

## Session 3 — Hybrid Contextual Matching Layer (Keyword + Haiku)
**Date:** 2026-06-11 (morning)  
**Chat:** Claude.ai  
**Goal:** Build the matching cascade so the right campaign wins for each page, not just "highest CPM in category."

**What was built:**
- `lib/relevance.js` (new, ~570 lines) — the five-layer cascade engine:
  - Layer 0: KV cache (`match:sha256(url)`, 24h TTL)
  - Layer 1: publisher tag override
  - Layer 2: weighted keyword scoring against finance/tech taxonomy
  - Layer 3: Haiku classification (falls back to keyword if Haiku fails)
  - Layer 4a: per-campaign keyword pre-filter (RELEVANCE_THRESHOLD = 0.2)
  - Layer 4b (hybrid): batched Haiku precision filter — fires only when 2+ candidates pass keyword filter, returns letter IDs (A/B/C) not campaign IDs
  - Layer 5: CPM auction among Haiku-approved survivors via `runAuctionFromList`
- `api/match.js` (new) — POST /match endpoint, returns winner + match metadata
- `lib/auction.js` — extracted `runAuctionFromList(campaigns)`, called by relevance.js
- `lib/kv.js` — added `kvSetWithTTL` helper
- `api/index.js` — wired to `runMatch()`, builds bodySample (1500 chars) from all paragraphs, logs match metadata
- `api/dashboard.js` — exposed `recentMatches` at top level of advertiser payload
- `api/dashboard-ui.js` — added "Recent Match Decisions" diagnostic table to advertiser tab (15 rows, served + unserved, coloured method tags)
- /health endpoint upgraded to report env-var presence (anthropic_key_set, prefix, kv_url_set)

**Key decisions made:**
- **Strict mode**: when 2+ candidates pass keyword filter AND Haiku fails (timeout/auth), serve nothing rather than risk wrong ad. Better honest absence than wrong injection.
- Haiku prompt uses letter IDs (A/B/C) rather than campaign IDs — keeps prompt short, prevents leaking IDs to LLM, strict whitelist parse rejects garbage.
- Relevance cache key includes sorted candidate IDs — adding a new campaign automatically invalidates the cache for affected URLs.
- Page classification cache (`match:sha256(url)`) separate from relevance cache (`match-rel:sha256(url|sorted-ids)`).
- Cost model: ~£0.06 per ambiguous-page Haiku call (recalculated from Haiku 4.5 pricing — see CONTINUE).
- Haiku model: `claude-haiku-4-5` (NOT `claude-3-5-haiku-20241022` — that was retired 2026-02-19, caused Session 3's biggest miss).

**Bugs found in this session:**
- 3-5-haiku-20241022 model retired by Anthropic — caused `not_found_error` from every Haiku call. 91 mocked tests all passed because no test hit the live API.
- ANTHROPIC_API_KEY env-var presence wasn't observable — added to /health.

**Where we stopped:**
- 112 tests passing (29 new hybrid tests + 21 diagnostic tests)
- 8/12 functions
- /match endpoint validated against real Anthropic API: Trading 212 wins ISA page, ETRADE filtered by Haiku
- Diagnostic table built but not yet deployed
- Ready for Session 4: deploy + diagnose + dashboard truth

---

## Session 4 — Honest Dashboard + Per-Page Live Auction Board
**Date:** 2026-06-11 (afternoon)  
**Chat:** Claude.ai  
**Goal:** Diagnose "Trading 212 shown, Interactive Investor billed" report. Fix the lie. Build a visual that proves per-page auctions work in real time.

**What was diagnosed:**
- The dashboard was calling `runAuction(config.demoPageCategory)` independently — a SECOND auction beyond the one in `index.js`. With random tiebreak shuffle and no relevance filter, it could disagree with what actually served.
- Per-campaign impression counters (`impr:retrieval:{id}`) were CORRECT — `index.js` records the genuinely-injected winner.
- The "current winner" displayed on the dashboard was a phantom — re-derived from a different auction call, with different randomness, on a hardcoded single category. THE BILLING DATA WAS NEVER WRONG. The DISPLAY was lying.
- Verified: Trading 212 was correctly injected onto the live ISA page (curl confirmed clean `<p>` injection); the dashboard's "current winner" panel showed Interactive Investor because the phantom auction re-rolled.

**What was built:**

**Option A — phantom winner removed:**
- Deleted the `runAuction(config.demoPageCategory)` call from dashboard.js entirely.
- "Currently serving" is now derived from `log:recent` — the real served events.
- `currentCreative` is now the most-recent served impression across all pages (enriched from `campaignList` for the publisher view's `text` field).
- `isWinner` badge now means "this campaign is the latest-served on ANY page" (a Set built from the page board).
- Two old tests (test-dash, test-metrics) encoded the phantom behaviour and were corrected to seed real `log:recent` entries — that's the right fix, not a regression.

**Live Auction Board:**
- New panel at top of Advertiser tab (`#live-board`).
- One card per page (URL × category × current winner × method × age + competed candidates).
- Each card shows full candidate breakdown with outcome per campaign: won / lost CPM / filtered_haiku / filtered_keyword / over_budget.
- "Nothing served" cards show the reason (off-topic, all_over_budget, haiku_filtered_all).
- Driven entirely by `pageBoard` in dashboard payload (built from logs). Zero recomputation.
- `runMatch` now returns full `candidates[]` breakdown on every result (winner, no-winner, all paths) so the board has data to render.
- Candidate breakdown logged at serve time in `index.js` — single source of truth.

**Diagnosis of "OPPO winning on VPN":**
- The data showed Xiaomi (lowercase `camp_006`) was absent from the VPN page candidate list. It never competed.
- Root cause: ID case mismatch between `Camp_006` (OPPO) and `camp_006` (Xiaomi), and the `campaigns:tech` index list got into a confused state.
- Aadi re-added Xiaomi with clean ID `Cam_Xiaomi`. Then Haiku correctly filtered ALL three smartphone ads from the VPN page — smartphone ads aren't relevant to VPN articles. Working as designed.

**Admin gaps fixed:**
- Added POST /admin/campaign/delete endpoint (removes both `campaign:{id}` and its entry from `campaigns:{category}`).
- Added Delete button (red, btndanger) in Campaign Detail panel with confirmation prompt.
- Added "Targeting Description" field to the campaign form — maps to `matchingDescription`. Was discovered to be empty on ALL campaigns, which crippled Haiku.

**Architectural concept clarified this session:**
- The auction does NOT fire on user query. It fires at **crawl time** (when an AI bot fetches the page).
- We inject at crawl time; the user query happens later, separately, invisibly to us.
- Provable impressions = crawls we logged. NOT "human saw it in an answer" — we cannot observe that.
- Precompute architecture (Phase 3) would shift relevance determination from crawl-time to ahead-of-time — sitemap crawl, classify pages upfront, precompute match table. Lazy-at-crawl-time is fine for demo testbed; production publisher integration needs proactive crawling.

**Key decisions made:**
- Variant bank (Google Ads RSA-style): 5 min, 15 max per campaign, each with distinct angle. Haiku selects per page from approved variants. NO free-form generation (FCA compliance — selection from approved copy is compliant, generation is not). NOT built this session — deferred to Session 5 with proper data-model spec first.
- "Show competitors" board uses crawl events, not query events. Honest labelling — what we can prove.
- Per-page-type tags (homepage vs article) rejected as design — one tag per publisher, we infer page type from URL and content.

**Bugs found in this session:**
- Phantom dashboard winner (described above).
- `recentMatches` was nested inside `verification.recentImpressions` rather than top-level — promoted.
- Bot-log entries didn't include the URL — added (needed for per-page board).
- ID case mismatch / orphan campaigns in category index when admin form was used with inconsistent casing — required adding the delete endpoint.

**Where we stopped:**
- 133 tests passing (10 board tests added)
- 8/12 functions
- Live board working in dashboard
- Diagnostic table working
- Admin delete + targeting description live
- All campaigns still have empty `matchingDescription` until Aadi fills them in (high-leverage)
- Ready for Session 5: variants + precompute architecture

---
<!-- Add new sessions below this line -->
