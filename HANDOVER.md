# HANDOVER.md — Current State & Next Steps

> This file is the task board and current-state snapshot.
> Update it at the end of every session. It's the first thing to read when picking up work.
> For WHY decisions were made, see CLAUDE.md. For lessons learned, see CONTINUE.md.
> For canonical naming and architecture, see PLATFORM_STRUCTURE_SPEC.md.
> For the approved build plan, see BUILD_PLAN.md.

---

## Current State (end of Session 12, 2026-06-23)

**Live URL:** https://testbot-two-psi.vercel.app
**Dashboard:** https://testbot-two-psi.vercel.app/ui (chooser only)
**GitHub:** https://github.com/aadithyask99-boop/testbot (main branch)
**Vercel:** Hobby plan — 10/12 serverless functions used, 2 free

### What's deployed and working
- Bot detection + HTML injection across GPTBot, Perplexity, Grok, Gemini, Meta AI, Claude
- The Matcher: 8-stage pipeline, precompute 10/10 coverage
- 17 campaigns (camp_002 through camp_017), 3 are Trading 212 (ISA, Stocks ISA, CFD)
- Relevance gate confirmed: camp_017 CFD excluded from ISA pages, wins on trading pages
- Pause/activate toggle confirmed working (camp_016 paused → camp_006 takes ISA page → reactivate → camp_016 retakes)
- Brand-mention validation gate — can't save variants without the advertiser name
- Revenue tracking: 80/20 split, atomic tenths-of-pence
- Portal: 2-section sidebar (Overview + Campaign for advertiser, Overview + Pages for publisher)
- Overview: merged cards + bar charts + date filter (7d/30d/60d/90d/Custom) + winning creative table + recent activity
- Campaign page: dropdown switcher, stats header with pause/activate, variant performance table, winning creative per page, Creative Studio (nested per-campaign), Add/Delete campaign
- KV parallelization: 16.7x speedup on dashboard responses (Session 11 fix)

### What's demo/not real yet
- Finance Weekly and Tech Briefing are demo publishers (zero domain authority)
- No real publisher partner
- Click tracking exists (`/click`) but click data invisible to advertisers
- No trackable links — no way for advertisers to measure click-through
- No conversational surface — only crawler injection, no `/chat` endpoint
- No prompt monitoring
- CPC pricing not built (deferred)

---

## Serverless Function Slots (10/12 used — UNCHANGED)

```
USED (10/12):
 1. api/index.js         Main detection/injection/logging
 2. api/admin.js         Campaign CRUD, Creative Studio, crawl, seed, reindex
 3. api/dashboard.js     Analytics API (3 views: operator/advertiser/publisher)
 4. api/dashboard-ui.js  Visual UI (chooser, admin, scoped portals)
 5. api/click.js         Click redirect + tracking (to gain /t/{token} handler)
 6. api/sdk.js           Publisher client-side snippet
 7. api/utils.js         /health + /robots.txt + /sitemap.xml + /ping
 8. api/match.js         /match for Workers + /chat/query (to gain chat branch)
 9. api/precompute.js    Precompute sweep + query aggregation (to gain)
10. api/impression.js    Impression tracking (to gain /chat/ping branch)

FREE (2/12):
11. → spare
12. → spare
```

---

## Planned Work — Sessions 13+

### Full build plan: see BUILD_PLAN.md

Two batches, three tracks. All approved with Aadi.

**Batch A — Link infrastructure (Track 1):**
1. Trackable Link Generator — `/t/{token}` route, admin endpoints, Campaign page UI
2. `[[anchor|url]]` inline syntax — injector parser, validation, Insert Link button
3. Click metrics — AI-referred clicks, platform breakdown, proxy citation rate

**Batch B — Conversational surface (Tracks 2 + 3):**
1. `/chat/query` endpoint — frequency capping, rate limiting, Matcher with query input
2. `/chat/ping` endpoint — impression confirmation, `impr:conversational:*` keys
3. Query Insights — query storage, on-demand aggregation, advertiser/publisher views
4. Publisher Conversational sidebar item + page

**Deferred:** CPC pricing (after Track 1 click data validates), variant auto-optimisation, advertiser pixel/beacon, admin portal content split.

### Architecture docs: see PLATFORM_STRUCTURE_SPEC.md Parts 21-25
- Part 21: Product Vision & Competitive Differentiation
- Part 22: Trackable Links Architecture
- Part 23: Conversational Surface (`/chat`)
- Part 24: Query Insights (Prompt Monitoring)
- Part 25: Two Surfaces — How They Relate

---

## Testing completed this session (Session 12)

| Test | Result | Detail |
|---|---|---|
| camp_016 + camp_017 created with brand attribution | ✅ | All 10 variants mention Trading 212 |
| Index correct (3 campaigns, CPM order) | ✅ | camp_017 £18, camp_016 £14, camp_002 £10 |
| Precompute: 10/10 coverage, event invalidation | ✅ | 100% coverage, all fresh |
| ISA page: camp_017 CFD excluded, camp_016 wins | ✅ | Relevance gate correct |
| Trading platform page: camp_017 CFD wins | ✅ | relevanceScore 0.947 |
| Variant selection: topic-matched per page | ✅ | ETF variant on ISA, forex variant on trading |
| Real GPTBot crawl: camp_016 injected, logged | ✅ | "Trading 212" confirmed in HTML, 9 paragraphs |
| Budget cap logic | ✅ | £0.01 cap passes at zero spend (correct — cap blocks on impression #2) |
| Pause camp_016 → camp_006 takes ISA page | ✅ | Real auction, not defaulting to camp_002 |
| Reactivate camp_016 → immediately retakes | ✅ | £14 CPM beats camp_006 |
| Brand-mention validation gate | ✅ | Rejected variant without brand name with explanation |

---

## Open Decisions for Aadi

1. **RELEVANCE_THRESHOLD for conversational queries** — current 0.2 was tuned for article-length content. May need adjustment for 10-20 word queries. Test after building Batch B, decide then.
2. **Campaign tiebreaker at identical effective CPM** — round-robin, first-created, or random? (carried over, unresolved)
3. **Publisher floor price** — per-publisher configurable, not yet built. (carried over)

---

## How to Verify the Live System

```powershell
# Advertiser overview
(Invoke-WebRequest "https://testbot-two-psi.vercel.app/advertiser/trading-212/overview" -UseBasicParsing).Content -match "chart-spend"

# Advertiser campaign
(Invoke-WebRequest "https://testbot-two-psi.vercel.app/advertiser/trading-212/campaign" -UseBasicParsing).Content -match "togglePause"

# Publisher overview
(Invoke-WebRequest "https://testbot-two-psi.vercel.app/publisher/financeweekly/overview" -UseBasicParsing).Content -match "chart-revenue"

# Simulate bot crawl
$h = @{"User-Agent"="Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)"}
(Invoke-WebRequest "https://finance-weekly-worker.projectatlas.workers.dev/articles/best-isa-2026.html" -Headers $h -UseBasicParsing).Content -match "Trading 212"

# Check recent matches
(Invoke-WebRequest "https://testbot-two-psi.vercel.app/dashboard?view=advertiser&advId=adv_002" -UseBasicParsing).Content | ConvertFrom-Json | Select-Object -ExpandProperty recentMatches | Select-Object -First 3 | Format-Table -AutoSize
```
