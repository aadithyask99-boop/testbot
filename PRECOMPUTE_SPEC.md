# PRECOMPUTE_SPEC.md — Session 6 Design Doc

> Spec first, code after — same process as VARIANT_BANK_SPEC.md.

---

## What This Is

Today, page category classification (`runMatch` Layers 0-3) happens lazily:
the FIRST bot ever to crawl a page pays the cost of keyword scoring + (if
ambiguous) a Haiku classification call, then the result is cached for 24h
(`match:{sha256(url)}`). Every subsequent crawl in that window hits the
cache for classification, but Layers 4-6 (relevance filter, auction, variant
selection) still run live every time — which is correct, since campaigns and
budgets change.

**Precompute** proactively warms the Layer 0-3 cache for known pages
BEFORE any bot arrives, so the first real crawl is always a cache hit for
classification. This matters because:
- A real publisher may have thousands of pages. Without precompute, each
  page's first-ever crawl pays Haiku latency (typically <1s, but adds up
  and is non-deterministic for a publisher gauging response times).
- Precompute gives a measurable "coverage" number: "X% of your pages are
  pre-classified and ready."

**What precompute does NOT do:** run the auction, select variants, or decide
what gets served. Those stay live (Layers 4-6), because campaigns/budgets/
variants change far more often than a page's TOPIC does. Precomputing the
auction result would mean stale ad-serving decisions — precomputing the
CATEGORY is safe because "this page is about VPNs" doesn't change.

---

## Two Trigger Mechanisms

### 1. Event-based invalidation (primary, real-time)
When a campaign is added/edited/deleted/paused via `/admin/campaign`,
the SET OF CANDIDATES for affected categories changes. This does NOT
invalidate `match:{sha256(url)}` (category classification is unaffected —
a page about VPNs is still about VPNs regardless of campaign changes).

**What it DOES invalidate:** the relevance-filter cache
(`match-rel:{sha256(url|candidateIds)}`, keyed in part by the candidate ID
set per `lib/relevance.js` line ~543) and the variant cache
(`variant:{sha256(url|campaignId)}`) for the edited campaign.

On `/admin/campaign` POST (create/edit), after `saveCampaign()` succeeds:
- For the campaign's category, delete `match-rel:*` entries — but Redis
  REST (Upstash) has no wildcard DEL via the simple command interface we're
  using. Practical approach: don't delete reactively; instead REDUCE the TTL
  is not directly possible either. **Simplest correct approach: skip
  surgical invalidation for now.** The relevance-filter cache is keyed on
  `url|candidateIds` — when a campaign is added/removed, the candidate ID
  set CHANGES, so the cache key itself changes and the OLD entry is simply
  never read again (it just expires naturally at 24h, harmlessly orphaned).
  When a campaign's `matchingDescription`/`variants`/`cpmGBP` is edited
  WITHOUT changing the candidate set, the cache key is unchanged and the
  stale entry WOULD be served for up to 24h.

  **Decision for this session:** explicitly delete the specific
  `match-rel:{sha256(url|candidateIds)}` and `variant:{sha256(url|campaignId)}`
  keys for EVERY known page (from `listPaths()`) when a campaign is saved,
  computing the current candidate-ID-set hash for that page's category. This
  is bounded (≤ number of known pages × number of categories the edit
  affects) and correct. At demo scale (5 pages) this is 5 KV deletes per
  campaign save — trivial.

### 2. Cron (secondary, slow safety net)
Vercel Hobby plan cron is limited to once per day. Given event-based
invalidation handles the real-time case, cron's job is narrow: sweep
`listPaths()` and run Layers 0-3 (classification only) for any page whose
`match:{sha256(url)}` entry is MISSING or older than 24h (i.e. about to
expire or already expired). This keeps the classification cache permanently
warm without requiring a bot to ever visit first.

`vercel.json` cron config:
```json
{
  "crons": [
    { "path": "/api/precompute?action=sweep", "schedule": "0 3 * * *" }
  ]
}
```
Runs daily at 03:00. Calls the new `api/precompute.js` function.

---

## New Function: api/precompute.js

**Slot count:** 8/12 → 9/12 after this (3 free remain). Justified by
isolation — sitemap parsing, batch iteration, and partial-failure handling
don't belong bolted onto `admin.js`.

### `GET /precompute?action=sweep` (cron target, also manually triggerable)
1. Read `listPaths()` from `lib/demo-pages.js` (today). For a real publisher
   (future), this becomes: fetch the publisher's `sitemap.xml`, parse `<url><loc>`
   entries.
2. For each path, build `pageSignals` from `getPage(path)` (title, meta,
   body excerpt) — same shape `api/index.js` already builds for live crawls.
3. For each page, check `kvGet('precompute:{sha256(url)}')`:
   - If missing or `computedAt` > 24h ago: run Layers 0-3 only (NOT the full
     `runMatch` — a new exported function `classifyOnly(pageSignals)` that
     does cache-check → publisher-tag → keyword → Haiku, and writes BOTH
     `match:{sha256(url)}` (existing key, so live crawls benefit too) AND
     `precompute:{sha256(url)}` (new key, with `source`/`computedAt`
     metadata for the coverage dashboard).
   - If fresh: skip, count as "already covered."
4. Return `{ swept: N, classified: M, skipped: K, errors: [...] }`.

### `POST /precompute?action=invalidate` (called internally by admin.js)
Body: `{ category }`. For every page in `listPaths()` whose page's category
matches (or — simplest — ALL pages, since candidate sets are per-category
but cheap to recompute for all 5 pages):
- Recompute the current candidate-ID-set for that page's category (read
  `campaigns:{category}`, build the same hash `lib/relevance.js` would)
- `kvDel('match-rel:' + hash)` and `kvDel('variant:' + sha256(url + '|' + campaignId))`
  for the edited campaign specifically.

Called from `api/admin.js` after `saveCampaign()` / pause / delete, via
internal `fetch` to `/precompute?action=invalidate` (same-deployment, no
auth needed beyond existing CORS).

---

## New KV Schema

```
precompute:{sha256(url)}   →  { category, method, computedAt, source: 'cron'|'manual' }
                               24h TTL (same lifetime as match: — they're
                               written together, precompute: is purely for
                               coverage reporting/diagnostics)
```

No change to `match:`, `match-rel:`, `variant:` key FORMATS — only new
explicit `kvDel` calls on campaign edits, and a new writer (precompute sweep)
in addition to the existing writer (live crawl via `runMatch`).

---

## New Demo Pages (for testing precompute meaningfully)

Two more pages added to `lib/demo-pages.js` so the sweep has more to do and
coverage % is a meaningful number (5 pages → 7):

1. `/articles/best-broadband-deals` — category: tech (keyword-confident,
   tests the "skip Haiku, keyword-only" path in the sweep)
2. `/articles/sipp-vs-workplace-pension` — category: finance (deliberately
   similar to `/articles/pension-vs-isa` — tests whether the relevance
   filter and auction still differentiate correctly between two
   topically-close finance pages with different keyword profiles)

Both follow the existing `makePage()` template, added to `PAGES` and picked
up automatically by `listPaths()` → sitemap → precompute sweep.

---

## Dashboard Changes

### New "Precompute Coverage" card (Operator tab)
```
Pages tracked: 7
Pre-classified: 7/7 (100%)
Last sweep: 2026-06-13 03:00 (cron) — 0 classified, 7 skipped (all fresh)
```
Sourced from a new `GET /precompute?action=status` endpoint — reads
`precompute:{sha256(url)}` for each `listPaths()` entry, returns counts +
last-sweep metadata (stored at `precompute:meta:last-sweep`).

### Live Auction Board — no change needed
`pageBoard` already shows `method`/`cached` per page. A precomputed page
will show `cached: true` with `method` reflecting whatever Layer 0-3
classified it as (keyword/haiku/publisher_tag) — precompute doesn't add a
new method value, it just means the FIRST crawl is already a cache hit.

---

## Build Order

1. Add 2 new demo pages to `lib/demo-pages.js` (low-risk, isolated)
2. `lib/relevance.js`: extract `classifyOnly(pageSignals)` — Layers 0-3 only,
   refactored out of `runMatch` (which calls it, then proceeds to 4-6).
   Writes `match:` AND `precompute:` together.
3. `api/precompute.js` — new function:
   - `?action=sweep` (GET, cron target)
   - `?action=status` (GET, dashboard card)
   - `?action=invalidate` (POST, called from admin.js)
4. `vercel.json` — add the precompute route + cron config (slot 9/12)
5. `api/admin.js` — after campaign save/pause/delete, fire-and-forget POST
   to `/precompute?action=invalidate`
6. `api/dashboard.js` + `dashboard-ui.js` — Precompute Coverage card
7. Manual sweep test: `curl -X GET .../precompute?action=sweep`, confirm
   `precompute:` keys populated, confirm a "fresh" bot crawl on a
   newly-added demo page shows `cached: true` on FIRST hit
8. Test event-based invalidation: edit a campaign's `matchingDescription`,
   confirm the relevant `variant:`/`match-rel:` keys are gone, confirm next
   crawl re-evaluates with the new description

---

## Open Items Confirmed

- Trigger: BOTH event-based (primary, real-time, surgical kvDel on campaign
  save) AND cron (secondary, daily safety-net sweep) — confirmed.
- Page discovery: sitemap-driven via `listPaths()` (already exists,
  generates `/sitemap.xml`) — confirmed. Real-publisher version (future)
  swaps `listPaths()` for sitemap-fetch-and-parse; the rest of the pipeline
  is unchanged.
- New dedicated `api/precompute.js` (9/12 slots) — confirmed, isolation
  over slot-conservation given only 3 free slots are needed beyond this.
