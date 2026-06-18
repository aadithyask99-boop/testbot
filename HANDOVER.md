# HANDOVER.md — Current State & Next Steps

> This file is the task board and current-state snapshot.
> Update it at the end of every session. It's the first thing to read when picking up work.
> For WHY decisions were made, see CLAUDE.md. For lessons learned, see CONTINUE.md.

---

## Current State (end of Session 9 — 2026-06-18)

**Platform URL:** https://testbot-two-psi.vercel.app (API only — no demo pages)
**Dashboard:** https://testbot-two-psi.vercel.app/ui
**GitHub:** https://github.com/aadithyask99-boop/testbot (main branch)
**Vercel:** Hobby plan — 10/12 serverless functions used, 2 free

### Live Publisher Sites
| Publisher | Site | Worker | pubId | Token |
|-----------|------|--------|-------|-------|
| Finance Weekly | finance-weekly.vercel.app | finance-weekly-worker.projectatlas.workers.dev | pub_001 | pk_pub_001_financeweekly |
| Tech Briefing | tech-briefing-tau.vercel.app | tech-briefing-worker.projectatlas.workers.dev | pub_002 | pk_pub_002_techbriefing |

### GitHub Repos
- Platform: github.com/aadithyask99-boop/testbot
- Finance Weekly: github.com/aadithyask99-boop/finance-weekly
- Tech Briefing: github.com/aadithyask99-boop/tech-briefing

### What's deployed and working
- **Bot detection** — 30/30 UAs correct. Named bots, anonymous crawler (DeepSeek), Googlebot excluded.
- **Injection** — Bots get 8 `<p>` tags (7 editorial + 1 injected). Humans get 7 (clean page).
- **Cloudflare Workers** — Readability-lite content extraction, full article text + headings to /match, X-Pub-Token auth, origin URL logging (not Worker proxy URL), anonymous crawler detection.
- **Auction** — CPM waterfall, 15 campaigns (camp_001–camp_015), Haiku relevance filtering, variant selection.
- **Data-led variants** — AJ Bell (v6/v7/v8), Interactive Investor (v6/v7), Norton (v6/v7) have data-led variants. Haiku prompt updated to prefer stat-based content over promotional copy.
- **Haiku variant selection** — Updated prompt: prefers specific statistics, research findings, concrete data over generic promotional claims.
- **Dashboard** — Tab-aware polling (operator view only on 10s poll, adv/pub on demand). Publisher picker re-fetches with pubId. Advertiser view shows competed pages not just won.
- **Per-publisher tracking** — stats:impressions:pub:{pubId}:total/date in KV. reset-stats now clears these.
- **Publisher tokens** — X-Pub-Token header auth on /match and /impression. pub_token:{token} → pubId reverse lookup.
- **Advertiser entities** — advertiser:{advId} records in KV, advertisers:all index.
- **Sitemap-driven precompute** — Sweep reads publisher sitemapUrls, fetches sitemap XML. Status reads from log:recent (no outbound HTTP restriction).
- **precompute?action=invalidate-url** — Clears variant + precompute cache for a specific URL directly.
- **LIVE badge** — Pulsing green badge on pages crawled < 30s ago.

### What's a demo placeholder / not yet built
- No real publisher auth — pickers are cosmetic, no login gating
- Publisher floor prices — floorCPM field exists in schema, NOT enforced in auction
- Precompute for real publisher pages — Vercel can't fetch remote HTML, pages classified live on first bot crawl
- Precompute sweep can't classify new publisher pages (Vercel outbound restriction) — pages get classified on first real bot crawl (lazy, works correctly)
- Cloudflare sweep Worker (for scheduled pre-classification) — planned but not built
- Rate signal in behavioural.js — requestsPerMinute always 1, +30pt signal never fires
- No billing/payments
- Single-page dashboard tabs — publisher/advertiser data isolated by picker, not by real auth

### Validated with real AI systems (Session 9)
- **ChatGPT Browse** crawled Finance Weekly first-time-buyer page. Surfaced injected AJ Bell data-led stat verbatim: "£300,000 average price, £833/month, 3 years". Described old promo variants as "promotional callouts". Data-led v8 bypassed this filter entirely.
- **ChatGPT Browse** detected Norton on VPN page but flagged as promotional callout (old promo variant at the time).
- Finance Weekly and Tech Briefing Workers correctly injecting on all 8 articles.

---

## Serverless Function Slots

```
USED (10/12):
1. api/index.js         Bot detection entry point (legacy — now API-only, serves 404 for demo paths)
2. api/admin.js         Campaign CRUD, seed, reindex, reset-stats
3. api/dashboard.js     Analytics API (operator/advertiser/publisher views)
4. api/dashboard-ui.js  Visual dashboard HTML
5. api/click.js         Click redirect + tracking
6. api/sdk.js           Publisher client-side snippet (legacy, not used in production)
7. api/utils.js         /health + /robots.txt + /sitemap.xml + /ping
8. api/match.js         Contextual matching + auction + variant selection
9. api/impression.js    Worker-side impression logging
10. api/precompute.js   Sitemap sweep + status + invalidate + invalidate-url

FREE (2/12):
11. → spare
12. → spare
```

---

## Campaign Reference (15 campaigns)

```
Finance (9 campaigns):
  camp_001  Vanguard UK (Demo)     £18   — seeded via /admin/seed
  camp_002  Trading 212            £120  ← wins ISA pages
  camp_003  Interactive Investor   £100  ← wins pension/dividend/SIPP pages. HAS DATA-LED v6/v7
  camp_004  E*TRADE                £70
  camp_005  Smart Pension          £70
  camp_006  Moneybox               £40
  camp_007  Freetrade              £10
  camp_012  Hargreaves Lansdown    £80
  camp_013  AJ Bell                £60   ← wins first-time-buyer. HAS DATA-LED v6/v7/v8

Tech (6 campaigns):
  camp_008  Oppo                   £100
  camp_009  Xiaomi                 £64
  camp_010  ExpressVPN             £19   ← wins broadband page
  camp_011  NordVPN                £18
  camp_014  Norton                 £25   ← wins VPN/antivirus. HAS DATA-LED v6/v7
  camp_015  Dropbox                £15   ← wins cloud storage
```

---

## Publisher Pages (8 real pages)

```
Finance Weekly (pub_001) — finance-weekly-worker.projectatlas.workers.dev:
  /articles/best-isa-2026.html       → Trading 212 £120
  /articles/pension-vs-isa.html      → Interactive Investor £100
  /articles/dividend-investing.html  → Interactive Investor £100
  /articles/first-time-buyer.html    → AJ Bell £60 (data-led v8 selected by Haiku)

Tech Briefing (pub_002) — tech-briefing-worker.projectatlas.workers.dev:
  /articles/best-vpn-2026.html       → Norton £25
  /articles/best-broadband.html      → ExpressVPN £19
  /articles/best-antivirus.html      → Norton £25
  /articles/cloud-storage.html       → Dropbox £15
```

---

## Immediate Next Tasks (priority order)

### Task 1: Clear Interactive Investor variant caches + validate data-led selection
**What:** AJ Bell v8 (data-led) is now proven working. Do the same for Interactive Investor — clear caches, re-crawl pension/dividend pages, verify Haiku picks v6 or v7 (flat-fee cost data) over v1 (award-winning ISA promo).
**How:**
```powershell
# Clear II variant caches
$pages = @("https://finance-weekly.vercel.app/articles/pension-vs-isa.html","https://finance-weekly.vercel.app/articles/dividend-investing.html","https://finance-weekly.vercel.app/articles/best-isa-2026.html")
foreach ($url in $pages) {
    $body = "{`"url`":`"$url`",`"campaignId`":`"camp_003`"}"
    Invoke-RestMethod -Uri "https://testbot-two-psi.vercel.app/precompute?action=invalidate-url" -Method POST -ContentType "application/json" -Body $body | Out-Null
}
# Re-crawl
foreach ($p in @("/articles/pension-vs-isa.html","/articles/dividend-investing.html")) {
    Invoke-RestMethod -Uri "https://finance-weekly-worker.projectatlas.workers.dev$p" -Headers @{"User-Agent"="Mozilla/5.0 (compatible; PerplexityBot/1.0)"} -TimeoutSec 15 | Out-Null
    Write-Host "Crawled: $p"
}
```

### Task 2: Publisher floor prices
**What:** Enforce floorCPM per publisher in auction. Schema exists, not enforced.
**Where:** lib/relevance.js runAuctionForCategory — fetch publisher:{pubId} from KV, check campaign.cpmGBP >= publisher.floorCPM before campaign enters auction.
**KV key:** publisher:{pubId}.floorCPM (null = no floor)

### Task 3: Cloudflare sweep Worker
**What:** Scheduled Cloudflare Worker that fetches publisher sitemaps, fetches each page HTML, calls /match with full page text, pre-classifies and pre-selects variants ahead of real bot crawls.
**Why:** Vercel can't do outbound HTTP to publisher pages. Cloudflare has no such restriction. Free cron triggers.
**Architecture:**
```
Cloudflare Worker (cron: every 6 hours)
  → fetch publisher sitemapUrls from /admin (or hardcoded)
  → for each URL: fetch page HTML
  → POST /match with full signals
  → /match classifies + runs auction + selects variant + caches
  → Next real bot crawl = instant cache hit, zero Haiku calls
```
**Files to create:** worker/sweep.js in testbot repo

### Task 4: Data-led variants for remaining campaigns
**What:** Trading 212 and ExpressVPN still have only promo variants. Add data-led variants.
**Trading 212 angles:**
- HMRC ISA subscription data (percentage of UK adults with ISAs)
- Cash ISA interest rate comparison data
- New investor first-year return statistics
**ExpressVPN angles:**
- UK ISP tracking statistics
- NCSC broadband security data
- VPN usage growth statistics

### Task 5: Real AI validation — Perplexity
**What:** Ask Perplexity "How long does it take to save for a first home in the UK?" — check if Finance Weekly data-led content surfaces.
**Note:** Perplexity lag is ~25 min. ChatGPT Browse already confirmed working in Session 9.

### Task 6: Norton data-led validation
**What:** Clear Norton variant caches on VPN/antivirus pages, re-crawl, verify Haiku picks v6 (NCSC stats) over v1 (promo).
```powershell
$techPages = @("https://tech-briefing-tau.vercel.app/articles/best-vpn-2026.html","https://tech-briefing-tau.vercel.app/articles/best-antivirus.html")
foreach ($url in $techPages) {
    $body = "{`"url`":`"$url`",`"campaignId`":`"camp_014`"}"
    Invoke-RestMethod -Uri "https://testbot-two-psi.vercel.app/precompute?action=invalidate-url" -Method POST -ContentType "application/json" -Body $body | Out-Null
}
```

---

## Key Operational Commands

### Recovery sequence after reset-stats
```powershell
# 1. Reset
Invoke-RestMethod -Uri "https://testbot-two-psi.vercel.app/admin/reset-stats" -Method POST

# 2. Seed publishers + advertisers + Vanguard demo
Invoke-RestMethod -Uri "https://testbot-two-psi.vercel.app/admin/seed" -Method POST

# 3. Reindex campaign category lists
Invoke-RestMethod -Uri "https://testbot-two-psi.vercel.app/admin/reindex" -Method POST

# 4. Upload all campaigns (from C:\Users\Atlas\Downloads\testbot\variant_payloads\)
foreach ($id in @("camp_002","camp_003","camp_004","camp_005","camp_006","camp_007","camp_008","camp_009","camp_010","camp_011","camp_012","camp_013","camp_014","camp_015")) {
    $path = "C:\Users\Atlas\Downloads\testbot\variant_payloads\payload_$id.json"
    $body = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $result = Invoke-RestMethod -Uri "https://testbot-two-psi.vercel.app/admin/campaign" -Method POST -ContentType "application/json; charset=utf-8" -Body $body
    Write-Host "$($result.campaign.id) - $($result.campaign.advertiser) - OK"
}

# 5. Re-crawl all pages
$pages = @("/articles/best-isa-2026.html","/articles/pension-vs-isa.html","/articles/dividend-investing.html","/articles/first-time-buyer.html")
foreach ($p in $pages) {
    Invoke-RestMethod -Uri "https://finance-weekly-worker.projectatlas.workers.dev$p" -Headers @{"User-Agent"="Mozilla/5.0 (compatible; PerplexityBot/1.0)"} -TimeoutSec 15 | Out-Null
    Write-Host "Crawled FW: $p"
}
$techPages = @("/articles/best-vpn-2026.html","/articles/best-broadband.html","/articles/best-antivirus.html","/articles/cloud-storage.html")
foreach ($p in $techPages) {
    Invoke-RestMethod -Uri "https://tech-briefing-worker.projectatlas.workers.dev$p" -Headers @{"User-Agent"="Mozilla/5.0 (compatible; GPTBot/1.0)"} -TimeoutSec 15 | Out-Null
    Write-Host "Crawled TB: $p"
}
```

### Cache invalidation (variant selection)
```powershell
# Invalidate variant cache for specific URL + campaign
$body = "{`"url`":`"https://finance-weekly.vercel.app/articles/first-time-buyer.html`",`"campaignId`":`"camp_013`"}"
Invoke-RestMethod -Uri "https://testbot-two-psi.vercel.app/precompute?action=invalidate-url" -Method POST -ContentType "application/json" -Body $body
```

### Health check
```powershell
curl https://testbot-two-psi.vercel.app/health
Invoke-RestMethod -Uri "https://testbot-two-psi.vercel.app/admin/reindex" -Method POST
```

---

## KV Data Schema (Session 9 additions)

```
# Publishers
publisher:{pubId}                              Object — {pubId, name, sitemapUrl, domains[], token, floorCPM, active}
publishers:all                                 Array — list of all pubIds
pub_token:{token}                              String — pubId (reverse lookup for token auth)

# Per-publisher stats
stats:impressions:pub:{pubId}:total            Integer — all-time impressions for this publisher
stats:impressions:pub:{pubId}:date:{date}      Integer — daily impressions
stats:impr_by_pub_plat:{pubId}                 Hash — per-platform impressions

# Advertisers
advertiser:{advId}                             Object — {advId, name, status, createdAt}
advertisers:all                                Array — list of all advIds

# Campaigns
campaign:{id}                                  Object — full campaign with variants[]
campaigns:finance                              Array — finance campaign IDs
campaigns:tech                                 Array — tech campaign IDs

# Match/precompute cache
match:{sha256(url)}                            {category, method, classifiedAt}  24h TTL
match-rel:{sha256(url|sorted-candidate-ids)}   {survivorIds, decidedAt}          24h TTL
variant:{sha256(url|campaignId)}               {variantId, method, selectedAt}   24h TTL
precompute:{sha256(url)}                       {category, method, classifiedAt, source}  24h TTL
precompute:meta:last-sweep                     {time, classified, skipped, pagesTotal, results[]}
precompute:meta:status-cache                   {coveragePct, pagesTotal, cachedAt}  60s TTL

# Logs
log:recent                                     List (last 100) — bot impressions with full match metadata
log:clicks                                     List (last 100) — publisher click entries
log:adclicks                                   List (last 100) — advertiser click entries
```

---

## Open Decisions

1. **Precompute for real publisher pages** — accepted that classification happens live on first bot crawl. Cloudflare sweep Worker would solve this but not yet built.
2. **Publisher floor prices** — decided per-publisher. Schema exists. Not enforced yet.
3. **Rate signal** — requestsPerMinute always 1. +30pt behavioural signal never fires. Remove or implement properly?
4. **No-campaign fallback** — what happens when no campaign matches a page? Currently serves nothing. House ad? Platform default?
5. **Trading 212 data-led variants** — still only has promo variants. ChatGPT flagged them as promotional. Needs data-led v6/v7.

---

## Critical Files (don't break these without parse gate)

- `api/dashboard-ui.js` — JS-in-JS-string concatenation. Single quotes only inside strings. Always run: `node -e "require('./api/dashboard-ui'); console.log('OK');"` after any edit.
- `lib/relevance.js` — Haiku model is `claude-haiku-4-5`. NOT claude-3-5-haiku. Variant selection prompt updated Session 9 to prefer data-led content.
- `vercel.json` — 10/12 functions. Check before adding any new file.
- `worker/index.js` — Template for publisher Workers. 4 config constants at top: ORIGIN_URL, PLATFORM_URL, PUB_ID, PUB_TOKEN. When editing, regenerate both publisher scripts (finance-weekly and tech-briefing repos).

---

## Worker Regeneration Command (run after any worker/index.js change)

```python
# Run from /home/claude/testbot in Claude environment
python3 << 'PYEOF'
configs = [
    {'dst': '/home/claude/finance-weekly-demo/worker/index.js', 'origin': 'https://finance-weekly.vercel.app', 'pub_id': 'pub_001', 'pub_token': 'pk_pub_001_financeweekly'},
    {'dst': '/home/claude/tech-briefing-demo/worker/index.js', 'origin': 'https://tech-briefing-tau.vercel.app', 'pub_id': 'pub_002', 'pub_token': 'pk_pub_002_techbriefing'},
]
with open('worker/index.js') as f:
    src = f.read()
for c in configs:
    content = src\
        .replace("const ORIGIN_URL    = 'https://finance-weekly-demo.vercel.app'; // publisher's site", f"const ORIGIN_URL    = '{c['origin']}'; // publisher's site")\
        .replace("const PUB_ID        = 'pub_001';                                 // your publisher ID", f"const PUB_ID        = '{c['pub_id']}';                                 // your publisher ID")\
        .replace("const PUB_TOKEN     = 'pk_pub_001_financeweekly';               // your auth token", f"const PUB_TOKEN     = '{c['pub_token']}';               // your auth token")
    with open(c['dst'], 'w') as f:
        f.write(content)
    print(c['pub_id'], 'OK')
PYEOF
```
