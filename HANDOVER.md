# HANDOVER.md — Current State & Next Steps

> This file is the task board and current-state snapshot.
> Update it at the end of every session. It's the first thing to read when picking up work.
> For WHY decisions were made, see CLAUDE.md. For lessons learned, see CONTINUE.md.
> For canonical naming and architecture, see PLATFORM_STRUCTURE_SPEC.md.

---

## Current State (end of Session 10, 2026-06-21)

**Live URL:** https://testbot-two-psi.vercel.app
**Dashboard:** https://testbot-two-psi.vercel.app/ui
**GitHub:** https://github.com/aadithyask99-boop/testbot (main branch)
**Vercel:** Hobby plan — 10/12 serverless functions used, 2 free

### What's deployed and working
- Bot detection + HTML injection — confirmed across ChatGPT Browse, Perplexity, Grok, Gemini, Meta AI, Claude
- The Matcher: 8-stage pipeline (see PLATFORM_STRUCTURE_SPEC.md §3 for full detail)
  - Stages 0-3 (category classification): precomputed by sweep
  - Stages 4-5 (per-campaign relevance + auction): live, benefits from cached classification
  - Stages 6-8 (variant selection): separately cached, NOT precomputed
- 14 active campaigns across finance and tech categories, all with data-led variants
- Revenue tracking: 80/20 publisher/platform split, atomic tenths-of-pence in KV
- Portal architecture:
  - `/ui` — chooser page (Advertiser / Publisher / Admin)
  - `/ui/admin` — full operator dashboard (unchanged)
  - `/ui/advertiser/{slug}` — scoped advertiser portal with: cards, sparkline, performance table, AI Creative Studio, Campaign (settings + add creative + variant bank with edit/remove), recent activity
  - `/ui/publisher/{slug}` — scoped publisher portal with: earnings cards, per-page serving table, recent activity
- AI Creative Studio: 3-idea input, 2 fact-led + 1 promo output, input gate, output traceability, em dash backstop
- Auto-crawl on variant save (60s delay) + manual Crawl buttons
- Variant ID stability across saves (normalizeVariants fix)

### What's a demo placeholder right now
- Publisher pages are hardcoded demo articles (Finance Weekly ISA/pension/dividend/first-time-buyer, Tech Briefing VPN/antivirus/broadband/cloud-storage)
- No real auth — portal access is URL-based only (anyone with the link sees the data)
- No Add Campaign or Remove Campaign UI in the advertiser portal (done via raw API only)
- Spend sparkline uses simulated variance, not real daily historical data
- Creative Studio output quality is inconsistent — safety filter sometimes too aggressive, prompt sometimes produces vague filler instead of honest "skipped" on weak ideas
- `api/sdk.js` is client-side only (headless browser detection) — secondary layer
- `requestsPerMinute` always 1 — behavioural rate signal (+30 pts) never fires

---

## Serverless Function Slots (10/12 used)

```
USED (10/12):
 1. api/index.js         Main detection/injection/logging
 2. api/admin.js         Campaign CRUD, Creative Studio, crawl, seed, reindex
 3. api/dashboard.js     Analytics API (3 views: operator/advertiser/publisher)
 4. api/dashboard-ui.js  Visual UI (chooser, admin, scoped portals)
 5. api/click.js         Click redirect + tracking
 6. api/sdk.js           Publisher client-side snippet
 7. api/utils.js         /health + /robots.txt + /sitemap.xml + /ping
 8. api/match.js         /match for Worker contextual matching calls
 9. api/precompute.js    Category classification sweep
10. api/impression.js    Revenue tracking with 80/20 split

FREE (2/12):
11. → api/publishers.js  (publisher management + Ad Unit formalization)
12. → spare
```

---

## Planned Work — Next Session(s)

### Priority 1: URL routing redesign
Drop the `/ui` prefix entirely. Proposed scheme:
```
/advertiser/{slug}/dashboard   — operational (settings, variants, Creative Studio)
/advertiser/{slug}/analytics   — deeper performance data
/publisher/{slug}/dashboard    — operational (earnings, serving status)
/publisher/{slug}/analytics    — traffic trends, crawl activity
/admin                         — full operator view
```
Requires: vercel.json route changes, dashboard-ui.js handler updates,
splitting the current single-page portal into dashboard + analytics pages.

### Priority 2: Publisher-side Ad Unit / Placement formalization
Turn hardcoded `PUBLISHER_PAGES` and `CATEGORY_PUBLISHERS` in admin.js into
real `adUnits[]` and `placements[]` structures per publisher in config/KV.
See PLATFORM_STRUCTURE_SPEC.md §5 for schema design.

### Priority 3: Add Campaign / Remove Campaign UI
Currently campaigns are only created/deleted via raw API calls or payload files.
The advertiser portal needs:
- "Add Campaign" button/form (creates a new campaign with this advId)
- "Delete Campaign" option (with confirmation)
This requires deciding: does Creative Studio sit inside each Campaign (so
generated variants target a specific campaign), or stay above all campaigns
as a general drafting tool?

### Priority 4: Creative Studio prompt quality
Current issues:
- Safety filter drops valid variants when numbers are reformatted by Haiku
  (e.g. "0.15%" → "15 basis points" → traceability fails)
- Fact-led variants sometimes produce vague filler ("comparable to several
  established platforms") instead of honestly skipping when no comparison exists
- Brand mention on fact-led variants is inconsistent

### Priority 5: Variant `focus` tag
Optional free-text tag on each variant for organizational grouping.
Agreed in Session 10, not yet implemented. See PLATFORM_STRUCTURE_SPEC.md §4.

---

## Open Decisions for Aadi

1. **Routing scheme confirmation:** `/advertiser/{slug}/dashboard` and `/analytics`
   as proposed, or different naming? What about `/admin`?
2. **Creative Studio per-campaign:** If an advertiser eventually has multiple campaigns,
   does Creative Studio sit inside each campaign (variants target that campaign) or
   stay above as a general tool (user manually picks which campaign to add to)?
3. **Campaign tiebreaker at identical effective CPM:** Round-robin, first-created, or random?
4. **Publisher floor price:** per-publisher configurable, stored in publisher schema.
   Not yet built. When built: floor applies to gross CPM before split.

---

## How to Verify the Live System

```bash
# Check chooser page
curl https://testbot-two-psi.vercel.app/ui

# Check scoped advertiser portal
curl https://testbot-two-psi.vercel.app/ui/advertiser/trading-212

# Check scoped publisher portal
curl https://testbot-two-psi.vercel.app/ui/publisher/financeweekly

# Simulate bot impression
curl -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" \
  https://finance-weekly-worker.projectatlas.workers.dev/articles/best-isa-2026.html

# Check dashboard API
curl https://testbot-two-psi.vercel.app/dashboard
curl "https://testbot-two-psi.vercel.app/dashboard?view=advertiser&advId=adv_002"
curl "https://testbot-two-psi.vercel.app/dashboard?view=publisher&pubId=pub_001"

# Manual crawl
curl -X POST -H "Content-Type: application/json" \
  -d '{"category":"all"}' \
  https://testbot-two-psi.vercel.app/admin/crawl

# Test Creative Studio
curl -X POST -H "Content-Type: application/json" \
  -d '{"advertiser":"Trading 212","ideas":["we have 1.6 million users","our fee is 0.15% vs industry average 0.45%","simple to use"]}' \
  https://testbot-two-psi.vercel.app/admin/creative-studio
```

---

## Key Files Changed in Session 10

| File | Changes |
|------|---------|
| api/admin.js | Auto-crawl infrastructure, Creative Studio endpoint (replaced AI Recommendations), normalizeVariants ID stability fix, manual crawl endpoint |
| api/dashboard.js | advId scoping for advertiser view, todayImpressions field, advId in campaignList |
| api/dashboard-ui.js | Portal routing (chooser, list, scoped portals), full advertiser portal (cards, sparkline, Creative Studio, Campaign section with settings/add/variants/edit/remove, recent activity), publisher portal with recent activity |
| lib/config.js | Slug fields on advertisers and publishers |
| lib/relevance.js | Removed old approval-gate logic |
| vercel.json | Anchored /ui routes, added /admin/crawl, /admin/creative-studio routes |
| variant_payloads/*.json | Data-led variants for all 14 campaigns, Freetrade keywords tightened |
| PLATFORM_STRUCTURE_SPEC.md | NEW: canonical naming + architecture reference |
