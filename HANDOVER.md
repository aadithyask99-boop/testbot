# HANDOVER.md — Current State & Next Steps

> This file is the task board and current-state snapshot.
> Update it at the end of every session. It's the first thing to read when picking up work.
> For WHY decisions were made, see CLAUDE.md. For lessons learned, see CONTINUE.md.

---

## Current State (end of Session 7)

**Live URL:** https://testbot-two-psi.vercel.app  
**Dashboard:** https://testbot-two-psi.vercel.app/ui  
**Worker (NEW):** https://testbot-worker.projectatlas.workers.dev —
proxies testbot-two-psi.vercel.app itself (proof-of-concept)
**GitHub:** https://github.com/aadithyask99-boop/testbot (main branch)  
**Worker repo location:** `worker/` directory in the same repo
(`wrangler.toml` + `index.js`)
**Vercel:** Hobby plan — **10/12** serverless functions used, 2 free  
**Cloudflare:** Workers free tier, `projectatlas.workers.dev` subdomain
registered Session 7
**Database:** Upstash Redis — pay-as-you-go (see Session 5 incident in
CONTINUE.md if KV reads/writes ever silently return null again)
**Tests:** 133 passing as of Session 4 (test files live in `/tmp`, not in
repo — not re-run since; re-run at next session start if touching core
match/auction logic)
**Anthropic API:** `claude-haiku-4-5` confirmed working — 3 possible calls
per page now (category classification, relevance filter, variant selection)
**Demo pages:** 7, all 100% pre-classified

### What's new this session — Cloudflare Worker SDK (Session 7, DONE)
- `worker/index.js` — DEPLOYED and VALIDATED live. Proxies
  testbot-two-psi.vercel.app, detects AI crawlers via an embedded
  pattern list (generated from `lib/detector.js` via
  `scripts/generate-worker-detector.js`), calls `/match`, injects the
  selected variant via HTMLRewriter, logs impressions via new
  `/impression` endpoint
- Confirmed: PerplexityBot injection matches origin exactly (position +
  content + variant), Googlebot passes through clean (cloaking-risk
  respected), human passes through clean, 3 real impressions logged
  correctly with Cloudflare edge IPs
- `api/impression.js` (NEW, 10/12) — Worker-side logging endpoint
- `api/match.js` — accepts `bodySample` now
- See SESSION_LOG.md Session 7 for the two injection-position bugs
  found and fixed live, and CONTINUE.md for lessons (esp. "trace actual
  output, don't reason about positions")

### KNOWN V1 LIMITATIONS for the Worker (both documented inline in
worker/index.js, both are assumptions about OUR OWN demo page template):
1. Assumes the page has an `<article>` wrapper — if `article p` matches
   zero elements, injection falls back to "before `</body>`" (works,
   but loses "after the intro" placement)
2. Assumes the first article paragraph has `class="byline"` — used to
   exclude it from classification SIGNALS (firstParagraph/bodySample),
   matching what `api/index.js` itself extracts. A real publisher's
   byline markup will differ or be absent.

Both need revisiting before pointing the Worker at a REAL publisher's
domain — see Session 8 options below.

### What's new this session — Precompute Classification Cache (Task 2, DONE)
- New `api/precompute.js` (9/12 functions): `?action=sweep` (classify
  stale/missing pages), `?action=status` (coverage report — now on the
  dashboard Overview tab), `?action=invalidate` (POST, called from
  admin.js on every campaign mutation)
- `lib/relevance.js`: `classifyOnly()` extracted (Layers 0-3 only,
  category classification). `runMatch` = `classifyOnly` + Layers 4-6
  (auction/variants), unchanged behavior. New `precompute:{sha256(url)}`
  cache, written alongside `match:` (with backfill for pre-existing
  `match:` entries — see CONTINUE.md)
- 2 new demo pages (best-broadband-deals/tech, sipp-vs-workplace-pension/
  finance) — 7 total now
- `TAXONOMY.tech` expanded with consumer hardware/telecoms terms
- Confirmed live: 7/7 pages, 100% coverage

### CRON DEFERRED (see CONTINUE.md)
Vercel `crons` config incompatible with this project's legacy
`routes`-based `vercel.json`. Event-based invalidation (the primary
mechanism per the spec) is wired and working; the sweep can be triggered
manually or via external cron. Migrating `vercel.json` to
`rewrites`+`functions` is a prerequisite if the daily sweep becomes
important (e.g. once a real publisher's sitemap has never-crawled pages).

### Previous session — Variant Bank (Task 1, DONE — Session 5)
- `campaign.text` removed entirely → `variants[]` (5-15 entries, each
  `{id, angle, text}`, text ≤200 chars)
- Layer 6 (`lib/relevance.js`, `selectVariant`): after a campaign wins the
  CPM auction, a SEPARATE Haiku call picks the best-fitting variant for that
  page. Round-robin fallback (`variant-rotation:{campaignId}`) if Haiku
  fails. Cached at `variant:{sha256(url|campaignId)}`, 24h TTL.
- All 11 campaigns migrated to the new schema (5 variants each) and live
- Dashboard: variant repeater in Add/Edit form, per-variant impression
  breakdown in campaign detail, `whyWon()` shows which variant was selected
  and how (`Variant "flat-fee pricing" (v2) selected via Haiku.`)

### Bugs fixed in Session 5 (found during live testing, not part of the plan)
- `/admin` GET was shadowed by the `/ad` route (`'/admin'.startsWith('/ad')`)
  — fixed with a stricter regex
- `kvGet` corrupted any value whose JSON contains a bare `%` (e.g. "0.15%")
  — `decodeURIComponent` threw, old code returned the raw string, callers
  spread it into a character-indexed object. Fixed: try `JSON.parse` first.

### What's deployed and working
- Bot detection + HTML injection (40+ crawlers, plain `<p>` tag, no fingerprints)
- Server-side per-page auction at crawl time via `runMatch` → `runAuctionFromList`
- Hybrid contextual matching layer (keyword pre-filter + Haiku precision filter + CPM auction among survivors)
- Page classification cache (24h TTL) + per-URL relevance cache (24h TTL, auto-invalidates when candidate set changes)
- 4 demo article pages (lib/demo-pages.js): best-isa-2026, pension-vs-isa, best-vpn-services, pasta-recipe
- Dashboard (three views: operator / advertiser / publisher) with:
  - **Live Auction Board** — per-page cards showing current winner, method, age, full candidate breakdown (won/lost/filtered_haiku/filtered_keyword/over_budget)
  - **Recent Match Decisions** — 15-row diagnostic table of last crawls with method tags
  - Campaign list with auction order + serving badge
  - Campaign detail panel with Edit + Delete buttons
  - Form fields including Targeting Description (matchingDescription)
- Atomic impression + spend tracking (HINCRBY-based, no race conditions)
- /health endpoint reports env-var presence for diagnostics
- /match endpoint exposed for direct testing
- POST /admin/campaign/delete endpoint (removes from store + category index)
- POST /admin/reset-stats for clean test cycles

### What is NOT yet built (architectural gaps for production)
1. **Per-publisher pubId + multi-publisher support** — everything is single-tenant. KV keys need `{pubId}` namespacing (including `precompute:`/`match:`, built single-tenant in Session 6, and the Worker's calls to `/match`/`/impression`, built single-tenant in Session 7). Deliberately deferred until a real second tenant exists — see Session 8 Path A.
2. **Publisher onboarding flow + floor prices** — no `publisher:{pubId}` records yet. Blocked on same as #1.
3. **Worker v2 hardening** — content-area fallback beyond `<article>`, byline-detection beyond `.byline`, behavioral/anonymous bot detection (DeepSeek pattern). See Session 8 Path B. Required before pointing the Worker at a real publisher's arbitrary markup.
4. **Daily precompute sweep via cron** — deferred Session 6, needs `vercel.json` migration from `routes` to `rewrites`+`functions` first. Event-based invalidation covers the real-time case; this is a safety-net for never-crawled pages. Low priority until publisher sitemaps are large.
5. **Real-world organic appearance probability** — cannot be measured on testbot-two-psi.vercel.app (zero-authority domain). Needs publisher partner with indexed traffic. NOT an engineering blocker — a business blocker. Session 7's Worker is the artifact that makes getting one more likely.

---

## Serverless Function Slots (8/12 used)

```
USED (8/12):
1. api/index.js         Main detection/injection — wired to runMatch()
2. api/admin.js         Campaign CRUD + /ad + reset-stats + delete
3. api/dashboard.js     Analytics API with pageBoard + recentMatches
4. api/dashboard-ui.js  Visual dashboard (concatenation format, parse-gated)
5. api/click.js         Click redirect + tracking
6. api/sdk.js           Publisher client-side snippet (placeholder)
7. api/utils.js         /health + /robots.txt + /sitemap.xml + /ping
8. api/match.js         POST /match — direct matching endpoint

FREE (4/12):
9.  → api/campaigns.js  (if campaign management outgrows admin.js)
10. → api/publishers.js (publisher onboarding + floor prices)
11. → api/precompute.js (sitemap crawl + classify + match-table builder)
12. → spare
```

---

## Immediate Next Tasks (in order)

### ✅ DONE — Task 0: matchingDescription
All 11 campaigns have a populated `matchingDescription`. Confirmed in
Session 5's migration.

### ✅ DONE — Task 1: Variant Bank
Built and live in Session 5. See "What's new this session" above and
SESSION_LOG.md Session 5 for full detail. `VARIANT_BANK_SPEC.md` in repo
root has the design doc if you need the original reasoning.

### ✅ DONE — Task 2: Precompute / Proactive Crawling
Built and live in Session 6, validated to 100% coverage. See "What's new
this session" above and SESSION_LOG.md Session 6 for full detail.
`PRECOMPUTE_SPEC.md` in repo root has the design doc.

**What got built vs the original sketch below:** the original sketch
described a publisher-onboarding-driven sitemap crawl with a
`match-precomputed:{pubId}:{urlHash}` key storing the FULL AUCTION RESULT.
What was actually built (and is the architecturally correct version,
confirmed during design): precompute warms ONLY the category
CLASSIFICATION (`precompute:{sha256(url)}`, Layers 0-3) — never the auction
winner. The auction (Layers 4-6) stays live because campaigns/budgets/
variants change far more often than a page's topic. This is simpler, safer
(no stale ad-serving decisions), and the per-publisher namespacing (Task 3
below) slots in cleanly on top: `precompute:{sha256(pubId+url)}` when
multi-tenant.

The "honest constraint" below still applies — still gated by publisher
partnership for the sitemap-crawl half (today uses `listPaths()` from
`lib/demo-pages.js` as the sitemap source).

### ✅ DONE — Task 4: Cloudflare Worker SDK
Built, deployed, and validated live in Session 7. See "What's new this
session" above and SESSION_LOG.md Session 7 for full detail.
`WORKER_SDK_SPEC.md` has the design doc, `worker/index.js` is the script,
Workers live at:
  - finance-weekly-worker.projectatlas.workers.dev (pub_001)
  - tech-briefing-worker.projectatlas.workers.dev (pub_002).

### Session 8 — Two paths, pick based on what's actionable

**Path A: Real publisher pilot (business step)**
Now that there's a working, demonstrable Worker — "paste this in,
change one config line, done" — this is the artifact to show a
prospective publisher. If Aadi has identified someone:
1. Update `worker/wrangler.toml` with their domain (`routes` block,
   requires their domain on Cloudflare DNS — or they add a Worker route
   via their own CF dashboard if they're already on Cloudflare)
2. Change `ORIGIN_URL` in `worker/index.js` to their actual origin
3. Address the two KNOWN V1 LIMITATIONS for THEIR markup specifically
   (does their page have `<article>`? what does their byline/metadata
   look like, if any?) — likely needs the v2 content-area fallback
   (Path B item 1) regardless
4. THIS is when Task 3 (per-publisher namespacing) becomes real and
   necessary — see below, now genuinely motivated by a real second
   tenant

**Path B: Worker v2 hardening (engineering step, no publisher yet)**
If no publisher lined up yet, harden the Worker against arbitrary HTML:
1. Content-area fallback when `article p` matches zero elements — try
   `main p`, `[role=main] p`, `.content p`, `.post-content p` in order,
   falling back to plain `p` (matches the pattern `api/sdk.js`'s
   placeholder already references: `'article p, main p, .content p, p'`)
2. Don't assume `.byline` — either accept the signal-quality hit for
   real publishers, or detect "metadata-like" first paragraphs heuristically
   (short, contains a date pattern, etc. — diminishing returns, maybe
   not worth it)
3. v2 bot detection: `lib/combined-detector.js`'s behavioral scoring
   (anonymous crawler path — DeepSeek pattern) — currently OUT of the
   embedded Worker patterns entirely (v1 only does self-identifying UAs)
4. Re-run `scripts/generate-worker-detector.js` if `lib/detector.js`'s
   crawler list has changed, refresh `BOT_PATTERNS` in `worker/index.js`

### Task 3: Per-publisher namespacing (NOW MOTIVATED BY Path A, if taken)
KV keys need `{pubId}` segments:
- `campaign:{pubId}:{id}` (or keep global campaigns and add `eligiblePublishers: ['pub_001']` to each campaign — design decision)
- `match:{pubId}:{urlHash}` and `precompute:{pubId}:{urlHash}` (cache is per-publisher because publishers can override page categories via `publisherCategory`)
- `spend:daily:{pubId}:{id}:{date}` only if we add per-publisher floors that affect spend
- Publisher record: `publisher:{pubId} = { name, floorCPM, sitemapUrl, active, createdAt }`
- `api/precompute.js`'s `?action=sweep` needs a `pubId` param once multi-tenant — currently sweeps `listPaths()` (single demo "publisher")
- `worker/index.js` would need to send `pubId` to `/match` and `/impression` — both currently single-tenant

**Honest constraint:** still gated by publisher partnership. The Worker
built in Session 7 is the artifact that makes "yes" more likely — but
Task 3 itself should wait until there's a real second tenant to design
against, per Session 7's framing decision.


---

## ⚠️ SESSION 8 START HERE — Aadi's new requests (paused mid-triage)

A new batch of requests was raised together at the end of Session 7's
chat, and the chat was paused/restarted before any of them were diagnosed
or designed (except the first item below, which has a partial diagnosis).
**Read this whole section before doing anything else.**

### 1. Live "Why" box regression — DIAGNOSIS IN PROGRESS, do this first

Aadi reported the Live Auction Board's "Why" box for `/articles/best-isa-2026`
now shows:
```
Trading 212 £120 CPM
via — · Perplexity · 10m ago
[injected text]
Why: Trading 212 served.
```
Expected (per Session 5/6 `whyWon()` design): a full explanation —
classification method, competitors filtered, CPM comparison, variant
selection method (e.g. `"Page classified as finance via keyword scoring
(score 0.52)... Trading 212 won at £120 CPM against... Variant 'first-time
investor' (v3) selected via Haiku."`).

`via —` (method empty/null) and `Why: {advertiser} served.` (a generic
fallback, not `whyWon()`'s normal output) both point to this `pageBoard`
entry having `method: null` and/or `candidates: null`.

**Diagnosis NOT YET DONE** — paused before fetching the actual `pageBoard`
JSON. First step:
```bash
curl -s "https://testbot-two-psi.vercel.app/dashboard?view=advertiser" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print([p for p in d['pageBoard'] if 'best-isa-2026' in p['url']])"
```
Look at `method`, `cached`, `candidates`, `relevanceScore`, `variantMethod`
for this entry — compare against a page still showing a full Why box
correctly, to isolate what's different.

**Leading hypothesis (UNVERIFIED):** `api/impression.js` (built Session 7
for the Cloudflare Worker) logs a MINIMAL `log:recent` entry — by its own
doc comment, it "does NOT call /match or know about variant angles/
methods/relevance scores." `pageBoard`/`whyWon()` were built in Sessions
5/6 BEFORE `/impression` existed, and assume every `log:recent` entry has
the FULL shape from `runMatch()` (method, candidates, relevanceScore,
variantMethod all present). Session 7's live Worker tests hit
`/articles/best-isa-2026` repeatedly (3 confirmed impressions, source:
'worker', in SESSION_LOG Session 7) — if one of THOSE became the most
recent `log:recent` entry for this URL, `pageServingMap` picks it up as
"current," and it lacks the fields `whyWon()` needs → falls back to
"served."

**If confirmed, two complementary fixes:**
- `whyWon()` (in `api/dashboard-ui.js`): handle the minimal/Worker-sourced
  shape gracefully (e.g. "Trading 212 served via Cloudflare Worker (full
  auction detail not logged for edge-sourced impressions)") instead of
  the bare "X served." fallback.
- `api/impression.js`: the Worker ALREADY HAS `method`, `candidates`,
  `relevanceScore`, `variantMethod` from its own `/match` response
  (`matchResult` in `worker/index.js`) — just isn't passing them through
  to `/impression`. Extend the `/impression` payload + `log:recent` entry
  to include these (optional fields, `null` if absent for non-Worker
  callers), so Worker-sourced impressions get full Why-box treatment too.

### 2. Add more articles + ad creatives via PowerShell
Mechanical — same pattern as Session 5's variant migration / Session 6's
demo-page additions. Low complexity, content needs drafting. Independent
of everything else — can be done any time.

### 3. Dummy publishers — assign articles to `publisher:{pubId}` records
This is a LIGHTER-WEIGHT version of Task 3, possibly: tag each
`lib/demo-pages.js` entry with a `pubId`, create `publisher:{pubId}`
display records (name, etc.), filter dashboard publisher view by `pubId`
— WITHOUT necessarily doing the full KV-key-namespacing refactor (separate
`match:{pubId}:...` etc.) that Task 3 originally specified. Whether the
light version is sufficient depends on the answer to #5 below — don't
build this until #5 is scoped, to avoid redoing it.

### 4. "All articles aren't shown on the advertiser side"
Possibly related to #3, or a separate bug. Check: does
`dashboard?view=advertiser`'s `pageBoard` include all 7 (or more, after
#2) `listPaths()` pages, or only ones that have been crawled at least
once? If only-crawled, that may be CORRECT (advertiser sees where ads HAVE
served, not could-serve) — confirm intent with Aadi before treating as a
bug.

### 5. ⚠️ NEEDS DESIGN — Account-scoped views ("everything is scattered")
THE BIG ONE. Aadi's framing: "an advertiser would click their account and
view all the shown stats, same for publishers." Currently
`dashboard?view=advertiser`/`?view=publisher` are SINGLE GLOBAL views —
no concept of "Trading 212's account" vs "Freetrade's account," or
"Finance Weekly" vs another publisher. This describes PER-ADVERTISER and
PER-PUBLISHER dashboard filtering (`?advertiserId=Cam_03` style) or
genuinely separate accounts — a SIGNIFICANT scope expansion beyond Task
3's original framing (Task 3 = KV namespacing for SERVING; this = UI/
reporting namespacing). Needs its own design doc. The shape of #3 (dummy
publishers) should probably be informed by this design, not precede it.

### 6. "Any way to show the live crawl?" — needs clarification
Unclear ask. Possibly: (a) real-time/streaming indicator when a crawl is
IN PROGRESS (vs current 5s-poll "last known state"), or (b) surfacing more
of `log:recent`/`pageBoard`'s existing data that isn't currently
displayed. Ask Aadi what "live" means here before scoping.

### Suggested order
1 (Why-box bug — concrete, diagnosable, likely small) → 2 (articles/
creatives — mechanical, unblocks testing more scenarios) → clarify 5 and 6
with Aadi (both need a conversation before any code) → 3/4 LAST, once 5's
shape is known, so "dummy publishers" is built to fit the eventual account
model rather than redone.

---

## Open Decisions Aadi Needs to Make (carried from earlier sessions + new)

- **No campaign match → serve what?** Empty (current), house ad, fallback generic? — STILL UNDECIDED. Default behaviour: serve nothing. Honest.
- **Campaign tiebreaker at identical CPM?** Currently random shuffle. Worked, but caused Session 4 confusion. Worth replacing with deterministic tiebreak (createdAt? round-robin?).
- **LLM for matching: Haiku (current) or alternatives?** Haiku 4.5 working well. ~£0.06 per ambiguous-page call, now TWO calls per ambiguous page (relevance + variant selection) since Session 5. Volume cost still trivial at demo scale.
- **Variant tiebreaker:** ✅ DECIDED Session 5 — round-robin per campaign via `variant-rotation:{campaignId}`, used only as a fallback when Haiku is unavailable or returns an unparseable variant ID.
- **Precompute trigger model:** ✅ DECIDED Session 6 — BOTH, event-based (primary, `/precompute?action=invalidate` fired from admin.js on every campaign mutation) + cron (secondary safety-net, DEFERRED — see "What is NOT yet built" #4).
- **Cache invalidation on matchingDescription edit:** ✅ DECIDED/BUILT Session 6 — `/precompute?action=invalidate` deletes the `match-rel:`/`variant:` keys for the edited campaign across all known pages on every save/pause/delete, replicating the live keyword-pre-filter candidate-set hash. NOT yet exercised live with an actual edit (see SESSION_LOG Session 6 "Where we stopped") — worth a quick live test next session.

---

## Things to Check at Session Start

1. Is the live site still up? `curl https://testbot-two-psi.vercel.app/ | head -20`
2. Is `/health` reporting `anthropic_key_set: true`? `curl https://testbot-two-psi.vercel.app/health`
3. What's the current per-page board look like? `curl https://testbot-two-psi.vercel.app/dashboard?view=advertiser | python3 -m json.tool | head -80`
4. How many Vercel functions? Check vercel.json — must not exceed 12.
5. Run full test suite: `for t in test-auction test-index test-dash test-metrics test-reset test-final test-multipage test-hybrid test-diagnostic test-board; do node /tmp/$t.js 2>&1 | grep "passed.*failed" | head -1; done`

---

## How to Seed / Reset for Testing

```bash
# Reset all stats (impressions, spend, logs)
curl -X POST https://testbot-two-psi.vercel.app/admin/reset-stats

# Create a campaign (Session 5+: variants required, 5-15, each text <=200 chars)
curl -X POST https://testbot-two-psi.vercel.app/admin/campaign \
  -H "Content-Type: application/json" \
  -d '{"id":"camp_FT","advertiser":"Freetrade","category":"finance","cpmGBP":10,"budgetDailyGBP":50,"budgetTotalGBP":1000,"keywords":["isa","pension","investment"],"matchingDescription":"UK ISA, SIPP and GIA investing platform","variants":[{"angle":"a1","text":"..."},{"angle":"a2","text":"..."},{"angle":"a3","text":"..."},{"angle":"a4","text":"..."},{"angle":"a5","text":"..."}],"advSlug":"ft","active":true}'

# Delete a campaign
curl -X POST https://testbot-two-psi.vercel.app/admin/campaign/delete \
  -H "Content-Type: application/json" \
  -d '{"id":"camp_FT"}'

# Simulate bot crawl on a specific article
for url in best-isa-2026 pension-vs-isa best-vpn-services pasta-recipe; do
  curl -s -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" \
    https://testbot-two-psi.vercel.app/articles/$url > /dev/null
done

# Check the per-page board
curl -s https://testbot-two-psi.vercel.app/dashboard?view=advertiser | python3 -m json.tool | head -100

# Direct /match call (bypasses bot detection — useful for matching tests)
curl -X POST https://testbot-two-psi.vercel.app/match \
  -H "Content-Type: application/json" \
  -d '{"url":"https://testbot-two-psi.vercel.app/articles/best-isa-2026","title":"Best ISA Accounts for 2026","metaDescription":"Compare top UK ISA platforms","firstParagraph":"An ISA lets you invest tax-free"}'
```

---

## KV Schema (current — as of end of Session 4)

```
# Per-campaign
campaign:{id}                              full campaign object (variants will be added Session 5)
campaigns:finance                          array of campaign IDs in finance category
campaigns:tech                             array of campaign IDs in tech category

# Spend (atomic HINCRBY)
spend:daily:{id}:{YYYY-MM-DD}              integer pence (or pounds — verify in auction.js)
spend:total:{id}                           integer

# Impressions (per-campaign, atomic)
impr:retrieval:{id}:total                  integer
impr:training:{id}:total                   integer
impr:by_camp_plat:{id}                     hash {platform: count}

# Aggregate stats
stats:impressions:total                    integer
stats:impressions:date:{YYYY-MM-DD}        integer
stats:impressions:type:retrieval           integer
stats:impressions:type:training            integer
stats:impr_by_platform                     hash {platform: count}
stats:clicks:total                         integer
stats:click_by_platform                    hash {platform: count}
stats:unique_clicks:total                  integer
stats:uniq_click_by_platform               hash {platform: count}
stats:adclicks:total                       integer
stats:bot_visits:total                     integer
stats:bot_served:total                     integer

# Match cache (Session 3+)
match:{sha256(url)}                        {category, method, classifiedAt}      24h TTL
match-rel:{sha256(url|sorted-candidate-ids)}  {survivorIds, decidedAt}            24h TTL

# Sessions
session:click:{IP}                         '1' with 300s TTL — unique click dedup

# Logs (LPUSH-trimmed lists, last 100 unless noted)
log:recent                                 list of bot impression entries (incl URL, candidates breakdown, match metadata) — Session 3+
log:clicks                                 list of publisher click entries (last 100)
log:adclicks                               list of advertiser click entries (last 100)
```

---

## Critical Files (don't break these without re-running parse gate)

- `api/dashboard-ui.js` — concatenation-format browser JS. Footgun. ALWAYS run parse gate after any edit: `node /tmp/render-ui.js && node --check /tmp/dash-inline.js`
- `lib/relevance.js` — Haiku model name is `claude-haiku-4-5`. NOT 3.5. If you change it, verify against live API first.
- `vercel.json` — function count is 8/12. Adding a file requires checking this and updating routes.

---

## How to package and deliver work for Aadi

Final files Aadi pulled into the repo at end of Session 4:
- session3-final-files.zip → matching layer + diagnostic table
- haiku-model-fix.zip → claude-haiku-4-5 fix
- health-env-check.zip → env-var presence on /health
- session4-board-files.zip → Option A + Live Auction Board (4 files: lib/relevance.js, api/index.js, api/dashboard.js, api/dashboard-ui.js)
- session4-admin-fixes.zip → delete endpoint, Targeting Description field, btndanger CSS (3 files: api/admin.js, api/dashboard-ui.js, vercel.json)

For new sessions: produce focused zips of changed files only, with clear scope per zip. Aadi unzips into the local repo, commits, pushes.
