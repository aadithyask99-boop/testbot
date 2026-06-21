# HANDOVER.md — Current State & Next Steps

> This file is the task board and current-state snapshot.
> Update it at the end of every session. It's the first thing to read when picking up work.
> For WHY decisions were made, see CLAUDE.md. For lessons learned, see CONTINUE.md.
> For canonical naming and architecture, see PLATFORM_STRUCTURE_SPEC.md.

---

## Current State (end of Session 11, 2026-06-21)

**Live URL:** https://testbot-two-psi.vercel.app
**Dashboard:** https://testbot-two-psi.vercel.app/ui (chooser only — see routing below)
**GitHub:** https://github.com/aadithyask99-boop/testbot (main branch)
**Vercel:** Hobby plan — 10/12 serverless functions used, 2 free

### What's deployed and working
- Bot detection + HTML injection — confirmed across ChatGPT Browse, Perplexity, Grok, Gemini, Meta AI, Claude
- The Matcher: 8-stage pipeline (see PLATFORM_STRUCTURE_SPEC.md §3 for full detail)
- 14+ campaigns across finance and tech categories, all with data-led variants
- Revenue tracking: 80/20 publisher/platform split, atomic tenths-of-pence in KV
- **Portal architecture (Session 11 — routing redesign, §1 DONE):**
  - `/ui` — chooser ONLY (links to `/advertiser`, `/publisher`, `/admin/dashboard`)
  - `/admin/dashboard`, `/admin/analytics` — full operator dashboard, content UNSPLIT
    (both serve the identical 3-tab view with a banner noting the split is planned)
  - `/advertiser`, `/publisher` — directory lists, link to `/dashboard` sub-paths
  - `/advertiser/{slug}/dashboard` — Cards, **Campaign** (dropdown switcher across
    multiple campaigns, settings, AI Creative Studio scoped per-campaign, variant
    bank, per-campaign recent activity, delete campaign)
  - `/advertiser/{slug}/analytics` — sparkline, campaign performance table (now
    with a **Campaign** column), advertiser-wide recent activity
  - `/publisher/{slug}/dashboard` — earnings cards, per-page serving table
  - `/publisher/{slug}/analytics` — recent activity (thin until Ad Unit/Placement
    work, Part 17 §2, lands)
  - All `/ui/*` sub-routes (except `/ui` itself) REMOVED — cut over in one deploy,
    no parallel-running period
- **Multi-campaign support (Session 11 — Part 17 §3 DONE, pulled forward):**
  previously every render path hardcoded `campaigns[0]`; the backend always
  supported multiple campaigns per `advId`. Now a real dropdown switcher,
  Add Campaign (5+ staged variants required before save), Delete Campaign.
- **AI Creative Studio relocated (Session 11):** now lives INSIDE the Campaign
  section, scoped per-campaign — reverses the Session 10 "separate drafting
  tool above Campaign" decision, on Aadi's explicit instruction. Same Haiku
  prompt/safety model (Part 7), unchanged.
- Auto-crawl on variant save (60s delay) + manual Crawl buttons
- Variant ID stability across saves (normalizeVariants fix)

### What's a demo placeholder right now
- Publisher pages are hardcoded demo articles (Finance Weekly ISA/pension/dividend/first-time-buyer, Tech Briefing VPN/antivirus/broadband/cloud-storage)
- No real auth — portal access is URL-based only (anyone with the link sees the data)
- Spend sparkline uses simulated variance, not real daily historical data
- Creative Studio output quality is inconsistent — safety filter sometimes too aggressive, prompt sometimes produces vague filler instead of honest "skipped" on weak ideas
- `api/sdk.js` is client-side only (headless browser detection) — secondary layer
- `requestsPerMinute` always 1 — behavioural rate signal (+30 pts) never fires
- Admin portal content split (Dashboard vs Analytics) — routing exists, content identical on both URLs

---

## Serverless Function Slots (10/12 used — UNCHANGED this session)

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

### Priority 1: Left-side persistent sidebar (raised mid-Session 11, NOT YET BUILT)
Real requirement, confirmed with Aadi, no prior written record found anywhere
before this session — see PLATFORM_STRUCTURE_SPEC.md Part 17 §7 for full
context and the open layout-choice decision (separate page per section vs.
one page with scrolling sections — shown to Aadi as a visual comparison,
not yet chosen). Confirmed sections: Overview, Campaign, Creative studio,
Analytics. **Important:** Creative Studio is a sub-item WITHIN Campaign, not
a sibling section — don't conflate the sidebar nav label with a routing
boundary.

### Priority 2: "Analytics is slow" — ✅ ROOT CAUSE FOUND AND FIXED (same session)
Aadi clarified it was specifically the campaign dropdown (and admin page's
publisher/advertiser picker) that was slow, not page-load in general. Traced
to `api/dashboard.js`: `campaignList` construction looped over every campaign
SEQUENTIALLY (4 awaited KV round-trips per campaign, one campaign at a time)
— with 15 campaigns, 60+ sequential network round-trips before the response
could start. Pre-existing since Session 5, not introduced this session — just
got worse as campaign count grew. Fixed by parallelizing with `Promise.all`
across campaigns (4 call sites: `campaignList`, `variantLookup`, per-publisher
revenue, per-advertiser revenue). Verified with a synthetic timing test:
16.7x faster with all correctness checks still passing. NOT yet verified live
by Aadi as of this entry — should confirm the dropdown actually feels fast
after this deploys.
**Known remaining inefficiency (not fixed, lower priority):** the
`view=advertiser&advId=X` endpoint still computes the FULL platform-wide
campaign list before filtering to the requested advId. No longer the
dominant cost since it's parallel now, but doing more work than necessary.

### Priority 3: Publisher-side Ad Unit / Placement formalization (Part 17 §2)
Turn hardcoded `PUBLISHER_PAGES` and `CATEGORY_PUBLISHERS` in admin.js into
real `adUnits[]` and `placements[]` structures per publisher in config/KV.
See PLATFORM_STRUCTURE_SPEC.md §2 (Part 17) for schema design. NOT yet
started.

### Priority 4: Variant `focus` tag (Part 17 §4)
Optional free-text tag on each variant for organizational grouping.
Agreed in Session 10, not yet implemented. See PLATFORM_STRUCTURE_SPEC.md
Part 17 §4.

### Priority 5: Creative Studio prompt quality (Part 17 §5)
Current issues:
- Safety filter drops valid variants when numbers are reformatted by Haiku
  (e.g. "0.15%" → "15 basis points" → traceability fails)
- Fact-led variants sometimes produce vague filler ("comparable to several
  established platforms") instead of honestly skipping when no comparison exists
- Brand mention on fact-led variants is inconsistent
NOT yet started — was next in the original build order before the
left-sidebar requirement surfaced and the multi-campaign work was pulled
forward ahead of it.

### Deferred, not in scope
- Part 17 §6 (Prompt-Level Visibility Monitoring) — intentionally deferred per Aadi's instruction at the start of this session.
- Admin portal content split (Dashboard vs Analytics sections) — Part 6, routing exists, content doesn't yet.

---

## Open Decisions for Aadi

1. **Sidebar layout:** separate page per section (own URL, lighter loads,
   shareable, more routing code) vs. one page with the sidebar
   scrolling/revealing sections (single URL, simpler, heavier initial load).
   Visual comparison shown; not yet chosen.
2. **Campaign tiebreaker at identical effective CPM:** Round-robin, first-created, or random? (carried over, unresolved)
3. **Publisher floor price:** per-publisher configurable, stored in publisher schema.
   Not yet built. When built: floor applies to gross CPM before split. (carried over, unresolved)

---

## How to Verify the Live System

Aadi is on Windows/PowerShell. `curl` in PowerShell is aliased to
`Invoke-WebRequest`, NOT curl.exe — flags like `-s`/`-o`/`-w` and tools like
`grep`/`/dev/null` do not work. Use PowerShell-native equivalents:

```powershell
# Chooser links
(Invoke-WebRequest -Uri "https://testbot-two-psi.vercel.app/ui" -UseBasicParsing).Links | Select-Object href

# Scoped advertiser portal — new routes
(Invoke-WebRequest -Uri "https://testbot-two-psi.vercel.app/advertiser/trading-212/dashboard" -UseBasicParsing).Content -match "AI Creative Studio"
(Invoke-WebRequest -Uri "https://testbot-two-psi.vercel.app/advertiser/trading-212/analytics" -UseBasicParsing).Content -match "Spend, last 7 days"

# Scoped publisher portal
(Invoke-WebRequest -Uri "https://testbot-two-psi.vercel.app/publisher/financeweekly/dashboard" -UseBasicParsing).Content -match "Ad serving"

# Dashboard API directly
(Invoke-WebRequest -Uri "https://testbot-two-psi.vercel.app/dashboard?view=advertiser&advId=adv_002" -UseBasicParsing).Content | ConvertFrom-Json

# Per-campaign activity filter (Session 11 addition)
(Invoke-WebRequest -Uri "https://testbot-two-psi.vercel.app/dashboard?view=advertiser&advId=adv_002&campaignId=camp_002" -UseBasicParsing).Content | ConvertFrom-Json

# Health check
(Invoke-WebRequest -Uri "https://testbot-two-psi.vercel.app/health" -UseBasicParsing).Content | ConvertFrom-Json | Format-List
```

If working from a Unix shell (bash/zsh) instead, standard curl + grep work as
normal — only PowerShell needs the above translation.

---

## Key Files Changed in Session 11

| File | Changes |
|------|---------|
| vercel.json | Removed all `/ui/*` sub-routes except `/ui` itself; added anchored `/advertiser`, `/advertiser/{slug}/dashboard`, `/advertiser/{slug}/analytics`, `/publisher`, `/publisher/{slug}/dashboard`, `/publisher/{slug}/analytics`, `/admin/dashboard`, `/admin/analytics`; fixed a shadowing bug where unanchored `/dashboard` would have substring-matched all four new `/dashboard`-suffixed routes |
| api/dashboard-ui.js | Full routing handler rewrite (slug+view query params); `scopedAdvertiserPortalHtml` split into `scopedAdvertiserDashboardHtml`/`scopedAdvertiserAnalyticsHtml`; `scopedPublisherPortalHtml` split likewise; new `navTabsHtml()` shared helper; Dashboard page's Campaign section rewritten for multi-campaign (dropdown switcher, per-campaign Settings/Creative Studio/Variants/Activity, Add/Delete campaign, staged-variant flow for new campaigns); Analytics page's performance table gained a Campaign column; admin `/admin/dashboard` and `/admin/analytics` both serve the unsplit view with a banner |
| api/dashboard.js | Added optional `campaignId` query param to the advertiser view, narrowing `recentMatches` to a single campaign (additive — falls back to prior advId-level scoping when absent) |
| PLATFORM_STRUCTURE_SPEC.md | Part 4 (advertiser portal) rewritten for the Dashboard/Analytics split and multi-campaign Creative Studio relocation; Part 8 missing-operations list marked resolved; Part 13 (routing) marked built with the shadowing-bug note; Part 17 §1 and §3 marked DONE; new §7 documenting the left-sidebar requirement and its open layout decision |
| CONTINUE.md | Session 11 learnings: jsdom behavioral testing approach, documenting decision reversals explicitly, handling "like we discussed" when no record exists, treating uploaded diagrams correctly, multi-campaign was already backend-supported |

**Verification approach this session:** no live Vercel access from the build
sandbox. Used `node --check` (parse gate, as before) PLUS a new technique —
installed `jsdom`, rendered the actual page HTML, mocked `window.fetch` with
a realistic payload, and ran real behavioral assertions (21 checks on the
dashboard page's campaign-switching logic, 5 on the analytics page's new
Campaign column) against the executing JS, not just its syntax. See
CONTINUE.md #18 for the technique and its one gotcha (mock `fetch` before
the auto-invoking `load()` call runs, not after).
