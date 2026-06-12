# HANDOVER.md — Current State & Next Steps

> This file is the task board and current-state snapshot.
> Update it at the end of every session. It's the first thing to read when picking up work.
> For WHY decisions were made, see CLAUDE.md. For lessons learned, see CONTINUE.md.

---

## Current State (end of Session 4)

**Live URL:** https://testbot-two-psi.vercel.app  
**Dashboard:** https://testbot-two-psi.vercel.app/ui  
**GitHub:** https://github.com/aadithyask99-boop/testbot (main branch)  
**Vercel:** Hobby plan — **8/12** serverless functions used, 4 free  
**Tests:** **133 passing** (test-auction 9, test-index 8, test-dash 7, test-metrics 12, test-reset 6, test-final 10, test-multipage 10, test-hybrid 29, test-diagnostic 21, test-board 21)  
**Anthropic API:** `claude-haiku-4-5` confirmed working against this account, key set in all three Vercel environments.

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
1. **Variant bank** — campaigns have one `text`. Should be `variants: [{id, text, angle}]` with Haiku selecting per page. Spec'd, not built. (Session 5 task)
2. **Precompute / proactive crawling** — relevance fires at crawl time today. Should be: publisher installs tag → we crawl their sitemap → classify pages upfront → precompute match table. Lazy crawl-time works for demo testbed, fails at production scale. (Session 6 task)
3. **Per-publisher pubId + multi-publisher support** — everything is single-tenant. KV keys need `{pubId}` namespacing. Publisher SDK (Cloudflare Worker) needs to inject pubId. (Session 6/7)
4. **Publisher onboarding flow + floor prices** — no `publisher:{pubId}` records yet. (Session 7)
5. **Cloudflare Worker SDK** — `api/sdk.js` is still client-side placeholder. (Session 7)
6. **Real-world organic appearance probability** — cannot be measured on testbot-two-psi.vercel.app (zero-authority domain). Needs publisher partner with indexed traffic. NOT an engineering blocker — a business blocker.

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

### Task 0: Fill in matchingDescription on every campaign (no code, ~10 min)
**Why high priority:** every existing campaign has `"matchingDescription": ""`. Haiku is judging relevance with only keywords + ad copy. Add one specific targeting sentence per campaign via dashboard Edit → Targeting Description field. Suggested values:
- Trading 212: `UK stocks, shares and cash ISA, commission-free investing`
- Freetrade: `UK ISA, SIPP and GIA investing platform for retail investors`
- Moneybox: `UK ISA, lifetime ISA, first home saving and pension consolidation`
- Interactive Investor: `UK stocks and shares ISA, investment platform, SIPP`
- E*TRADE: `US equity and options trading platform, American brokerage` (will keep being correctly filtered on UK pages — that's the test working)
- OPPO / Xiaomi: `Android smartphone, AI photography features, consumer mobile hardware` (will keep being correctly filtered from VPN — until you add a real privacy/security campaign)

### Task 1: Variant Bank — campaign schema upgrade (Session 5 — START HERE)
**Spec on paper first**, then code. The data-model decision touches schema + admin UI + match path + serve path + logging + dashboard, so a written design doc is mandatory.

**Schema change:** campaign object gets:
```
variants: [
  { id: "v1", text: "...", angle: "first-home" },
  { id: "v2", text: "...", angle: "pension-consolidation" },
  ...up to 15
]
```
- Min 5 variants per campaign, max 15. Encourage *distinct angles* not paraphrases.
- Single `text` field deprecated but kept for back-compat (auto-migrated to one variant on next save).

**Match path:** after Haiku approves a campaign for a page, a SECOND Haiku call picks the best variant for that (page × campaign). Cached by `variant:sha256(url|campaignId)`, 24h TTL.

**FCA constraint (hard rule):** variant selection ONLY. NO generation. Haiku picks from approved fragments, never writes new copy. Compliance officer's view: selection from approved copy is approved copy.

**Logging:** record `variantId` on each impression. Dashboard shows per-variant impression breakdown — advertiser sees "your 'first-home' angle wins 60% of the time."

### Task 2: Precompute / Proactive Crawling (Session 6)
**The core idea:** instead of running relevance lazily at crawl time, walk the publisher's sitemap when they sign up, classify every page upfront, precompute the eligible-campaign-set per page. Bot arrives → KV lookup of "what wins on this URL" → fast inject.

**New things needed:**
- `POST /publishers/onboard` — accepts publisher tag info + sitemap URL
- Background crawler (Vercel cron? Manual trigger?) — walks sitemap, calls `runMatch` per URL, caches result
- `match-precomputed:{pubId}:{urlHash}` KV key — the precomputed answer
- Recompute trigger when campaigns added/edited (re-run match for affected pages)
- Honest "precompute progress" UI in dashboard (X of Y pages classified)

**Honest constraint:** still gated by publisher partnership. No engineering substitute for "we have a real publisher with indexed AI traffic."

### Task 3: Per-publisher namespacing
KV keys need `{pubId}` segments:
- `campaign:{pubId}:{id}` (or keep global campaigns and add `eligiblePublishers: ['pub_001']` to each campaign — design decision)
- `match:{pubId}:{urlHash}` (cache is per-publisher because publishers can override page categories)
- `spend:daily:{pubId}:{id}:{date}` only if we add per-publisher floors that affect spend
- Publisher record: `publisher:{pubId} = { name, floorCPM, sitemapUrl, active, createdAt }`

### Task 4: Cloudflare Worker SDK
Workers code that publishers paste into their CF dashboard. Worker:
1. Fetches the origin page
2. Sniffs the User-Agent
3. If bot: calls our `/match?url=...&pubId=...` (with page signals), gets a winner, injects creative paragraph into the response HTML
4. If human: returns response unmodified
5. Logs the impression via our endpoint

Publisher's site can be on ANY hosting (WordPress, Ghost, custom) — the Worker sits in front. This is the production deployment story for Phase 4.

---

## Open Decisions Aadi Needs to Make (carried from earlier sessions + new)

- **No campaign match → serve what?** Empty (current), house ad, fallback generic? — STILL UNDECIDED. Default behaviour: serve nothing. Honest.
- **Campaign tiebreaker at identical CPM?** Currently random shuffle. Worked, but caused Session 4 confusion. Worth replacing with deterministic tiebreak (createdAt? round-robin?).
- **LLM for matching: Haiku (current) or alternatives?** Haiku 4.5 working well. ~£0.06 per ambiguous-page call. Volume cost trivial at demo scale.
- **Variant tiebreaker:** if Haiku says all variants are equally relevant, pick which? — round-robin per campaign? Random? Most-recently-edited?
- **Precompute trigger model:** cron-based (every N hours) or event-based (on campaign edit)? Cost vs freshness tradeoff.
- **Cache invalidation on matchingDescription edit:** today the relevance cache invalidates on candidate-set change (campaign added/removed/paused) but NOT on a campaign's description being edited. Should it? Otherwise edits don't take effect until 24h TTL expires.

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

# Create a campaign
curl -X POST https://testbot-two-psi.vercel.app/admin/campaign \
  -H "Content-Type: application/json" \
  -d '{"id":"camp_FT","advertiser":"Freetrade","category":"finance","cpmGBP":10,"budgetDailyGBP":50,"budgetTotalGBP":1000,"keywords":["isa","pension","investment"],"matchingDescription":"UK ISA, SIPP and GIA investing platform","text":"...","advSlug":"ft","active":true}'

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
