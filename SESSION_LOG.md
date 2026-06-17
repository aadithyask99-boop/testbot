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

## Session 5 — Variant Bank
**Date:** 2026-06-12
**Chat:** Claude.ai (claude.ai chat, not Claude Code)
**Goal:** Build the Variant Bank — each campaign gets 5-15 ad copy variants with
distinct angles; Haiku selects the best-fitting variant per page after the
campaign wins the CPM auction. Selection only, no generation (FCA constraint).

**What was built:**
- Design doc: `VARIANT_BANK_SPEC.md` — schema, match-path sequencing, caching,
  round-robin fallback, all confirmed with Aadi before coding
- Schema: `campaign.text` removed entirely, replaced with `variants[]`
  (5-15 entries, each `{id, angle, text}`, text ≤200 chars). No migration —
  schema replacement, existing campaigns re-entered manually via the new form.
- `lib/config.js`: default Vanguard campaign rewritten with 5 variants;
  new `variantLimits` (min 5, max 15, maxTextLength 200)
- `lib/auction.js`: `isEligible()` now requires non-empty `variants[]`
- `lib/relevance.js`: new Layer 6 `selectVariant()` — fires ONCE, only for the
  auction winner. `haikuSelectVariant()` is a SEPARATE Haiku call (not combined
  with the relevance filter) — whitelist-parsed against known variant IDs.
  `roundRobinVariant()` via atomic `kvIncr('variant-rotation:{campaignId}')`
  as fallback. New cache `variant:{sha256(url|campaignId)}`, 24h TTL.
- `api/index.js`: injects `selectedVariant.text`; impression log gains
  `variantId`/`variantAngle`/`variantMethod`; new `variant-impr:{campaignId}`
  HINCRBY counter for per-variant impression tracking
- `api/admin.js`: `validateVariants()` (5-15 count, required fields, 200-char
  max, duplicate-angle warning), `normalizeVariants()` assigns stable v1..vN
- `api/dashboard.js`: `variantBreakdown` per campaign (impressions + % per
  angle), `currentCreativeFull` now resolves the SPECIFIC served variant
  (not just the campaign's first variant)
- `api/dashboard-ui.js`: Ad Copy textarea replaced with a variant repeater
  (add/remove rows, live char counter, 5-15 client-side validation);
  `renderVariants()` in campaign detail panel; `whyWon()` extended with a
  variant line for all 4 methods (haiku / haiku_cached / round_robin /
  only_option)
- `api/sdk.js`: placeholder client-side path updated to read `variants[0]`

**Bugs found and fixed this session (NOT part of the variant bank plan):**
- `/admin` GET was being shadowed by the `/ad` route check
  (`'/admin'.startsWith('/ad')` is true) — fixed with a regex that only
  matches `/ad`, `/ad/...`, `/ad?...`
- `kvGet` in `lib/kv.js` could corrupt any value whose JSON contains a bare
  `%` not part of valid percent-encoding (e.g. ad copy "0.15%") —
  `decodeURIComponent` throws "URI malformed", the old code's catch returned
  the RAW JSON STRING, and callers spreading it (`{...c}`) produced a
  character-indexed object. Fixed: try `JSON.parse(result)` first, only
  fall back to decode+parse if that fails.

**Incident — Upstash quota exhaustion (NOT a code bug):**
- Mid-session, all KV reads/writes started returning `null` with no visible
  error (writes/reads silently fail via kvGet/kvSet's catch blocks). Looked
  exactly like data corruption/loss — campaign count dropped from 11 to 1 to 0.
- Root cause: Upstash free tier hit its 500k commands/month limit. Diagnosed
  via a temporary `/admin/debug-kv` endpoint that did a raw Upstash
  SET+GET roundtrip and returned the actual HTTP 400
  `"ERR max requests limit exceeded"` response.
- Resolution: Upgraded Upstash to pay-as-you-go via Vercel Storage tab,
  redeployed. ALL ORIGINAL DATA WAS INTACT — nothing was actually lost,
  it was just unreadable during the outage. Temporary `/admin/debug-kv`
  and `/admin/repair-index` endpoints removed after confirming recovery.

**Migration completed:**
- All 11 campaigns now have 5 variants each (Vanguard seeded with new
  default; the other 10 — Trading 212, interactive investor ISA, Oppo,
  E*TRADE, Smart Pension, Xiaomi, Moneybox, Express VPN, NordVPN, Freetrade —
  migrated via `/admin/campaign` POSTs with variants drafted from their
  original `text`/`matchingDescription`)
- `matchingDescription` was already populated for all 11 from a prior
  session — Task 0 from HANDOVER.md is effectively done

**Validated live:**
- Live Auction Board confirmed: Haiku-selected variants appear in the "Why"
  box (e.g. `Variant "flat-fee pricing" (v2) selected via Haiku.`)
- Auction + relevance filter + variant selection all working together
  correctly on real crawls (interactive investor ISA winning over higher-CPM
  off-topic bidders, Express VPN winning the VPN article, pasta-recipe
  correctly served nothing)

**Where we stopped:**
- 8/12 serverless functions (unchanged)
- All 11 campaigns on the variant bank schema, live and verified
- Pre-existing duplicate `/admin/reset-stats` block in admin.js (lines ~67-91
  and ~93-130 from before this session) still present — flagged, not fixed,
  out of scope
- Ready for Session 6: precompute/proactive crawling (HANDOVER.md Task 2)
## Session 6 — Precompute Classification Cache
**Date:** 2026-06-12
**Chat:** Claude.ai (claude.ai chat, not Claude Code)
**Goal:** Stop relying on the first-ever bot crawl to pay the classification
cost for each page. Proactively warm the category-classification cache
(Layers 0-3) so real crawls always hit a warm cache, with event-based
invalidation when campaigns change.

**What was built:**
- Design doc: `PRECOMPUTE_SPEC.md` — both trigger mechanisms confirmed
  (event-based invalidation primary, cron as a deferred slow safety-net)
- `lib/demo-pages.js`: +2 pages (now 7 total)
  - `/articles/best-broadband-deals` (tech, keyword-confident)
  - `/articles/sipp-vs-workplace-pension` (finance, deliberately close to
    pension-vs-isa, tests Haiku differentiation between adjacent topics)
- `lib/relevance.js`: extracted `classifyOnly()` (Layers 0-3 only) from
  `runMatch`. Writes `match:{sha256(url)}` (existing, read by live crawls)
  AND `precompute:{sha256(url)}` (new, coverage/diagnostics: category,
  method, classifiedAt, source) together on a cache MISS. On a cache HIT
  where `precompute:` is missing, BACKFILLS it (source: 'backfill') —
  see bug below.
- `lib/relevance.js`: expanded `TAXONOMY.tech` with consumer hardware/
  telecoms terms (broadband, smartphone, router, fibre, wi-fi, 5g,
  internet, mobile, app, device, streaming, connectivity, processor) —
  the old taxonomy was SaaS/dev-only and scored the broadband page 0,
  falling back to 'other' without Haiku
- `api/precompute.js` (NEW, 9/12 functions):
  - `GET /precompute?action=sweep` — classify pages with missing/stale
    `precompute:` entries
  - `GET /precompute?action=status` — coverage report (% covered, last
    sweep summary, per-page category/method/source/freshness)
  - `POST /precompute?action=invalidate` — deletes `match-rel:`/`variant:`
    cache entries for an edited campaign, replicating the EXACT
    keyword-pre-filter candidate-set hash the live auction path computes
- `api/admin.js`: fire-and-forget `invalidatePrecomputeCaches()` after
  campaign create/update/pause/delete (non-fatal — caches expire at 24h
  TTL anyway, this is a propagation-speed optimization)
- Dashboard: new "Precompute Coverage" card on Overview tab (coverage %,
  last sweep summary, per-page status)
- `vercel.json`: `/precompute` route added (9/12)

**Bug found and fixed (live, during validation):**
- First live sweep reported `classified: 7` but `status` showed only
  `3/7 covered`. Root cause: 4 of the 7 pages already had warm `match:`
  entries from Session 5 live crawls (within 24h TTL) — `classifyOnly`'s
  cache-hit path returned early WITHOUT writing `precompute:` per the
  original spec ("on cache hit, no write occurs"). Fixed: on cache hit,
  if `precompute:` is missing, backfill it from the cached `match:` entry
  (`source: 'backfill'`). Re-swept after the fix → 7/7, 100% coverage,
  confirmed live.

**CRON DEFERRED:** Vercel's `crons` config is incompatible with this
project's legacy `routes`-based `vercel.json` (`crons` requires
`functions`/`rewrites` syntax). Event-based invalidation is the PRIMARY
freshness mechanism per the spec, so this is non-blocking. To add the
daily sweep safety-net later: migrate `vercel.json` to `rewrites`+
`functions`, then add the `crons` block from `PRECOMPUTE_SPEC.md`. Until
then, `/precompute?action=sweep` can be triggered manually or via an
external cron (GitHub Actions, cron-job.org).

**Validated live:**
- Sitemap correctly lists all 7 pages
- Sweep classified all 7 pages correctly (4 keyword, 2 haiku, including
  the two new pages and the two adjacent-topic finance pages)
- Coverage status: 7/7, 100%, with `source` correctly distinguishing
  `cron` (this session's sweeps) vs `backfill` (Session 5 live crawls)

**Where we stopped:**
- 9/12 serverless functions (3 free)
- All 7 demo pages pre-classified, 100% coverage confirmed
- Event-based invalidation wired into all campaign mutation endpoints,
  not yet exercised live (no campaign edited this session after the wiring
  landed — worth a quick live test next session: edit a campaign's
  `matchingDescription`, confirm `/precompute?action=invalidate` fires and
  the relevant `match-rel:`/`variant:` keys are gone)
- Ready for Session 7: per-publisher namespacing + publisher onboarding +
  floor prices, OR Cloudflare Worker SDK (HANDOVER.md has both queued)

## Session 7 — Cloudflare Worker SDK
**Date:** 2026-06-12
**Chat:** Claude.ai (claude.ai chat, not Claude Code)
**Goal:** Build the thing a real publisher would actually install —
a Cloudflare Worker that sits in front of a site, detects AI crawlers,
and injects sponsored content without any origin server changes.
Deferred per-publisher namespacing (Task 3) since there's no real
second tenant yet — this is the artifact needed to GET one.

**What was built:**
- `WORKER_SDK_SPEC.md` — design doc. Key decisions: `/match` (existing,
  no new slot) as the Worker's decision endpoint; bot detection via an
  EMBEDDED pattern subset generated from `lib/detector.js` (not a
  callback API — avoids a network hop on every human pageview); test
  target is testbot-two-psi.vercel.app itself (Worker proxies its own
  demo pages first, before any real publisher)
- `lib/detector.js`: guarded the self-test block with
  `require.main === module` — it was printing to stdout on every
  `require()`, breaking the generation script's output capture
- `scripts/generate-worker-detector.js` (NEW, manual-run helper):
  generates the embedded `BOT_PATTERNS` array from `lib/detector.js`'s
  `AI_CRAWLERS` (35/35 entries qualify — all simple string patterns)
- `api/match.js`: accepts `bodySample` in the request body
- `api/impression.js` (NEW, 10/12 functions): Worker-side impression
  logging. Replicates `api/index.js`'s exact KV writes —
  `impr:{type}:{campaignId}:{date/total}` (matches `lib/auction.js`'s
  `imprKey` exactly — initially written with the WRONG format
  `stats:impressions:...`, caught before deploy), global `stats:*`
  counters, per-platform/per-campaign-platform/per-variant hashes,
  `log:recent` entry with `source: 'worker'`
- `worker/index.js` (NEW): the Worker script. Fetches origin with a
  non-bot UA (avoids double-injection/double-counting), detects bots
  via embedded `BOT_PATTERNS`, extracts page signals via HTMLRewriter,
  calls `/match`, injects the selected variant via HTMLRewriter,
  fire-and-forget logs via `/impression`
- `worker/wrangler.toml` (NEW) — Cloudflare deploy config
- `vercel.json`: `/impression` route added (10/12)

**Deployed live:** `https://testbot-worker.projectatlas.workers.dev`
(Cloudflare Workers free tier, `projectatlas.workers.dev` subdomain
registered this session)

**Bugs found and fixed during live testing (2 rounds):**
1. Injection landed after the header's tagline `<p>` instead of after
   the byline — `HTMLRewriter`'s `p` selector counted the
   `<header><p>UK personal finance &amp; investing</p></header>` tagline
   as paragraph #1. Fixed: scoped to `article p`.
2. Still one position off after fix #1 — landed after the 2nd
   `article p` (byline + 1st content para) instead of after just the
   byline. Traced `lib/injector.js`'s ACTUAL output directly
   (`injectSponsoredContent` with a test marker) to confirm the correct
   position is "after the 1st `article p`" (the byline) — `lib/
   injector.js`'s "2nd `</p>` globally" = header tagline (#1) + byline
   (#2). Fixed: `pSeen === 1` (was 2). Also excluded `.byline` from
   SIGNAL extraction (firstParagraph/bodySample) — `api/index.js`'s own
   extraction never sees the byline either, so including it would have
   made the Worker's classification signals WORSE than the origin's.

**Validated live (all via deployed Worker vs direct origin comparison):**
- PerplexityBot via Worker: injection position, content, and variant
  selection (Trading 212 "v2" / first-time-investor) match origin exactly
- Googlebot via Worker: passes through unmodified (cloaking-risk
  respected) — confirmed both before and after the position fixes
- Human UA via Worker: passes through unmodified
- 3 real impressions logged via `/impression`, `source: 'worker'`,
  correct campaign/variant/platform attribution, real Cloudflare edge
  IPs (172.7x.x.x ranges) confirming genuine edge traffic

**Where we stopped:**
- 10/12 serverless functions (2 free)
- Worker proof-of-concept fully validated against our OWN demo pages
- NOT YET DONE: pointing the Worker at a REAL publisher's domain
  (requires `routes`/custom domain config in `wrangler.toml`, and the
  KNOWN V1 LIMITATIONS documented inline in `worker/index.js` —
  `<article>` wrapper assumption, `.byline` class assumption — would
  need revisiting for a real publisher's actual markup)
- Task 3 (per-publisher namespacing) still pending — now genuinely
  blocked on "do we have a publisher," which this Worker is the pitch
  artifact for
- Ready for Session 8: either a real publisher pilot (business step,
  using this Worker as the install artifact), OR v2 hardening of the
  Worker (behavioral/anonymous bot detection, content-area heuristics
  beyond `<article>`, `routes` config for a real domain)


---

## Session 8 — PAUSED before start (triage only)
**Date:** 2026-06-12
**Chat:** Claude.ai (new chat opened, immediately paused)
**Goal:** Not yet started. A batch of new requests was raised at the very
end of Session 7's chat; the chat was paused/restarted before any
diagnosis or design work began.

**What happened:** Docs (this file, HANDOVER.md, CONTINUE.md) were updated
to capture Aadi's new requests in detail so a fresh chat can pick up
without re-explaining. See HANDOVER.md "⚠️ SESSION 8 START HERE" for the
full list (6 items) and suggested order. One item (Live Auction Board
"Why" box regression on `/articles/best-isa-2026`) has a partial diagnosis
and a leading hypothesis already written up — start there.

**No code changes this entry.** Function count, deployments, etc. all
unchanged from Session 7 (10/12 functions, Worker live at
testbot-worker.projectatlas.workers.dev).

**Late fixes Session 8:**
- Root cause of HL/AJ Bell not competing: campaigns:finance index was null after reset-stats cleared it
- Added /admin/reindex endpoint to rebuild category indexes from existing campaign:{id} KV keys
- Added /admin/reindex route to vercel.json
- Added missing payload_camp_006.json (Moneybox)
- After reindex: HL competing on all 7 finance pages, AJ Bell winning first-time-buyer-guide
- Fixed advertiser viewable card to derive from filtered campaign list not global totalViewable
- GitHub PAT configured in Claude environment for direct pushes

**Final state Session 8:**
- 12 pages: 8 Finance Weekly, 4 Tech Briefing
- 15 campaigns: camp_001-camp_015
- All category indexes rebuilt and verified
- All advertisers competing correctly

## Session 9 — Publisher Onboarding, Bot Detection Audit, Sitemap Sweep, Live Publisher Test
**Date:** 2026-06-17
**Goal:** Verify bot detection across all models, wire up real publisher sites, sitemap-driven precompute

**What was built:**

**Bot detection audit:**
- 30/30 UA cases correct: all named bots, anonymous crawler (DeepSeek), Googlebot excluded, real humans pass
- Worker v2: added anonymous crawler detection (Chrome UA without Accept-Language/sec-ch-ua/sec-fetch-mode = bot at 75% confidence)
- Worker v2: added main p / [role=main] p injection fallback for publishers without article tags
- Verified: bots get 8 paragraphs (7 editorial + 1 injected), humans get 7 (no injection)

**Sitemap-driven precompute:**
- precompute sweep now reads publisher sitemapUrls from config (fetchAllPublisherUrls)
- Fetches and parses sitemap XML, extracts all loc URLs
- Remote pages fetched and classified (HTML extraction + Haiku)
- Status still uses listPaths() — avoids self-referential HTTP fetch inside Vercel
- Coverage: 12/12 pages (100%)

**Publisher/advertiser entities:**
- advertiser:{advId} KV records seeded for all 15 advertisers
- advertisers:all index in KV
- Publisher tokens added: pk_pub_001_financeweekly, pk_pub_002_techbriefing
- pub_token:{token} → pubId reverse lookup in KV
- /match and /impression now resolve pubId from X-Pub-Token header
- Worker sends X-Pub-Token on every /match and /impression call
- Worker config block: ORIGIN_URL, PLATFORM_URL, PUB_ID, PUB_TOKEN (4 lines to change per publisher)

**Live publisher sites deployed:**
- finance-weekly.vercel.app — 4 finance articles (ISA, pension, dividend, first-time buyer)
- tech-briefing-tau.vercel.app — 4 tech articles (VPN, broadband, antivirus, cloud storage)
- finance-weekly-worker.projectatlas.workers.dev — proxies Finance Weekly, injects ads
- tech-briefing-worker.projectatlas.workers.dev — proxies Tech Briefing, injects ads

**Verified live:**
- Finance Weekly: Trading 212 ad injected on /articles/best-isa-2026.html (pub_001, source: worker)
- Tech Briefing: Norton ad injected on /articles/best-vpn-2026.html (pub_002, source: worker)
- Both pubIds logging correctly in dashboard recentImpressions

**GitHub repos:**
- github.com/aadithyask99-boop/finance-weekly
- github.com/aadithyask99-boop/tech-briefing

**Where we stopped:**
- Both publisher Workers live and verified
- Admin reindex endpoint added (/admin/reindex)
- LIVE badge in dashboard (30s pulse after real crawl)
- All 15 campaigns indexed correctly
- Next: crawl all articles on both publisher sites, verify dashboard shows them, update HANDOVER
