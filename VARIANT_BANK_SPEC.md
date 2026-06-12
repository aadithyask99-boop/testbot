# VARIANT_BANK_SPEC.md — Session 5 Design Doc

> Spec first, code after. This is the design for the variant bank feature.
> Once Aadi confirms, implementation proceeds file-by-file against this doc.

---

## What This Is

Today each campaign has one `text` field — one piece of ad copy, always shown verbatim.
This feature lets a campaign have **5–15 variants**, each with a distinct angle
(e.g. "first-home saver" vs "pension consolidation" vs "low fees"). When a campaign
wins the auction for a page, Haiku picks the single best-fitting variant for that
page from the approved set. **Selection only — no generation.** This is an FCA
compliance hard constraint: choosing among pre-approved copy is compliant;
an LLM writing new financial marketing copy is not.

Analogy: Google Ads Responsive Search Ads — advertiser supplies multiple headline/
description options, the platform picks the best combination per impression, but
never writes new text.

---

## Decision: No Migration — Schema Replacement

This is a test environment with a handful of demo campaigns. We are **not**
building auto-migration or back-compat shims for the old `text` field.

- `text` field is **removed** from the campaign schema entirely.
- `variants[]` becomes the only place ad copy lives.
- The Add/Edit Campaign form is rewritten to manage variants directly.
- Existing campaigns (Trading 212, Freetrade, Moneybox, Interactive Investor,
  E*TRADE, OPPO, Xiaomi) will have their current `text` re-entered as variant #1
  via the new form, then Aadi adds more variants with distinct angles.
- This is done in the same pass as Task 0 (filling in `matchingDescription`) —
  one edit session per campaign, both fields updated together.

**Any campaign with `variants` missing or empty is simply not eligible to win
the auction** (same as a campaign with empty `text` is ineligible today —
`isEligible()` in auction.js already checks `if (!campaign.text) return false`,
this becomes `if (!campaign.variants || campaign.variants.length === 0) return false`).

---

## Schema

```json
{
  "id": "camp_001",
  "advertiser": "Hargreaves Lansdown",
  "category": "finance",
  "cpmGBP": 22,
  "budgetDailyGBP": 50,
  "budgetTotalGBP": 500,
  "keywords": ["isa", "investment", "pension", "stocks", "platform"],
  "matchingDescription": "UK personal finance, ISA accounts, pension planning, investing",
  "variants": [
    { "id": "v1", "text": "...", "angle": "first-home saver" },
    { "id": "v2", "text": "...", "angle": "pension consolidation" },
    { "id": "v3", "text": "...", "angle": "low fees" }
  ],
  "link": "https://hl.co.uk",
  "linkText": "Visit Hargreaves Lansdown",
  "advSlug": "hargreaves-lansdown",
  "active": true,
  "startDate": "2026-06-10",
  "endDate": null,
  "updatedAt": "..."
}
```

**Validation rules (enforced in admin.js on save):**
- `variants` must have 5–15 entries.
- Each variant requires non-empty `text` and `angle`.
- `angle` strings should be distinct (warn, not block, if duplicates detected —
  duplicates are a content-quality issue, not a data-integrity one).
- Variant `id` values are `v1`..`v15`, assigned in order on save (simple, stable,
  no UUID needed at this scale).

---

## Match Path: Two Sequential Haiku Calls

Confirmed: **separate calls**, not combined. Sequencing:

```
1. Layer 0-3 (existing): cache → publisher tag → keyword score → Haiku category
2. Layer 4 (existing): relevance filter — Haiku call #1 scores each CANDIDATE
   CAMPAIGN's relevance to the page, drops campaigns below threshold (0.2)
3. Layer 5 (existing): runAuctionFromList among survivors → ONE winner by CPM
4. NEW Layer 6: Haiku call #2 — variant selection, fires ONCE for the winner only
5. Inject winner.variants[selectedVariantId].text
```

**Why call #2 only fires for the winner, never for all candidates:**
Variant selection is wasted work for campaigns that don't win the CPM auction.
Running it only on the winner keeps the cost model intact (~£0.00003/call,
one extra call per page per cache-miss, not per-candidate).

### Haiku Call #2 — Variant Selection

**Input:** page signals (title, metaDescription, firstParagraph/bodySample) +
the winning campaign's variant list (id + angle + text, or just id + angle to
save tokens — text only needed if angle alone is ambiguous).

**Prompt shape:**
```
Page title: {title}
Page description: {metaDescription}
Page excerpt: {bodySample}

Below are approved ad variants for {advertiser}. Pick the ONE that best fits
this page's topic. Respond with ONLY the variant id (e.g. "v3").

v1 ({angle}): {text}
v2 ({angle}): {text}
...
```

**Output parsing:** whitelist against known variant IDs for this campaign
(`v1`...`v15`), same pattern as category classification — never trust free-form
output, match against the known set. If Haiku returns something not in the set,
fall through to round-robin (below).

**Failure modes (all fall back to round-robin):**
- Haiku API error / timeout / missing key
- Haiku returns unparseable or unknown variant ID
- Cache miss is fine — only failure of the *call itself* triggers fallback

### Round-Robin Tiebreaker

Used when:
- Haiku explicitly indicates a tie (not in initial scope — Haiku is asked to
  pick exactly one, so this mainly covers...)
- Haiku call fails outright (see failure modes above)

**Implementation:** per-campaign rotation counter in KV.
```
variant-rotation:{campaignId}  →  integer, incremented atomically (kvIncr)
selectedIndex = rotationCounter % variants.length
```
This guarantees even distribution across variants over time when Haiku is
unavailable, without needing to track per-variant serve counts separately.

---

## Caching

**New cache key:** `variant:{sha256(url + '|' + campaignId)}` → `{ variantId, decidedAt, method }`, 24h TTL.

- Keyed on **url + campaignId** (not just url) — if a different campaign wins
  the auction for the same URL on a different day (campaign paused/budget
  exhausted/new campaign added), the variant cache for the old winner is simply
  unused, no invalidation needed. New winner gets its own cache entry on first
  hit.
- `method` field records `"haiku"` or `"round-robin"` — surfaces in the
  diagnostic table / "Why" box for troubleshooting (e.g. "Variant v3
  ('pension consolidation') selected via Haiku" vs "...via round-robin
  fallback").

**Existing relevance cache (`match-rel:...`) is untouched** — this is a new,
independent cache layer that sits after the auction, not a replacement.

---

## Logging & Dashboard

### Impression logging
`log:recent` entries gain a `variantId` and `variantAngle` field alongside the
existing campaign/category/method fields.

### Dashboard — Live Auction Board ("Why" box)
Extends the existing `whyWon()` explanation with a variant line, e.g.:

> "Trading 212 won the CPM auction at £60. Variant 'first-home saver' (v2)
> selected via Haiku — best match for ISA-for-first-time-buyers content."

or on round-robin fallback:

> "...Variant 'low fees' (v3) selected via round-robin (Haiku unavailable)."

### Dashboard — Campaign Detail panel
New "Variants" section below the existing `matchingDescription` (Targeting)
block:
- List of all variants with angle + text preview (truncated)
- Per-variant impression count (from `log:recent` aggregation or a new
  `variant-impr:{campaignId}:{variantId}` HINCRBY counter — counter is cheaper
  to read than scanning logs, recommend the counter)
- This is the "your 'first-home' angle wins 60% of the time" view from
  HANDOVER.md

### Add/Edit Campaign Form
- `text` field removed entirely.
- New repeating "Variant" block: angle (short text input) + text (textarea),
  with Add/Remove variant buttons.
- Client-side validation: minimum 5, maximum 15, before allowing save.
- Save button disabled / shows count ("3 of minimum 5 variants") until valid.

---

## Files Touched

| File | Change |
|---|---|
| `lib/config.js` | Remove `text` from default campaign shape, add `variants[]` |
| `lib/auction.js` | `isEligible()` checks `variants.length > 0` instead of `text` |
| `lib/relevance.js` | Add Haiku call #2 (variant selection) after auction, before return; add round-robin fallback; new cache key |
| `lib/kv.js` | No new functions needed — `kvIncr`, `kvSetWithTTL`, `kvHashIncr` all exist |
| `api/admin.js` | Validation for variants array (5–15, required fields); save/load variant-rotation counter init |
| `api/dashboard.js` | Add `variantId`/`variantAngle` to logged impression data; add per-variant impression counts to campaign detail payload |
| `api/dashboard-ui.js` | Variants section in detail panel; extend `whyWon()` with variant line; rewrite Add/Edit form (remove `text`, add variant repeater) — **mandatory parse gate after edits** |
| `api/index.js` | No change expected — already calls `runMatch()`, which now internally does the extra Haiku call |

**Function count:** unchanged, 8/12. This is all within existing files (no new
serverless functions).

---

## Confirmed Decisions

1. **Variant text length: 200 characters max per variant.** Enforced client-side
   (textarea maxlength) and server-side (admin.js validation). 200 chars keeps
   Haiku call #2 cheap even with full variant text included in the prompt
   (15 variants × 200 chars ≈ 3000 chars ≈ 750 tokens — fine for a 10-token-max
   response call). If 200 proves too tight for real ad copy later, revisit —
   not a hard architectural constraint, just today's value.
2. **`updatedAt` is campaign-level only.** No per-variant timestamps.
3. Round-robin tiebreaker, separate Haiku calls, no migration (schema
   replacement, manual re-entry) — all confirmed.

---

## Build Order

1. Schema + config.js + auction.js eligibility check (small, low-risk)
2. Admin form rewrite — variant repeater UI + validation (biggest UI chunk,
   do this in isolation, test against parse gate before touching dashboard-ui
   further)
3. relevance.js — Haiku call #2 + round-robin + new cache key (backend logic,
   testable independently via direct `/match` POST calls)
4. Dashboard detail panel — variants section + per-variant counters
5. `whyWon()` extension — variant line in Why box
6. Re-enter copy for existing 7 campaigns as variants (manual, via new form,
   combined with Task 0 matchingDescription pass)
7. Full regression — re-run relevant test patterns against live deploy
