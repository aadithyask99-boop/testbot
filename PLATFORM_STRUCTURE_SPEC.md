# PLATFORM_STRUCTURE_SPEC.md — Naming & Hierarchy Reference

> This file is the canonical naming and structural reference for the platform.
> Read this before building anything in the advertiser portal, publisher portal,
> or matching pipeline. If a name used elsewhere in the docs or code conflicts
> with this file, THIS FILE IS RIGHT — flag the conflict and fix it, don't
> silently follow the older name.
>
> Written: Session 10. This document exists specifically to prevent naming
> drift and hallucination across multiple future Claude sessions working on
> different parts of the platform.

---

## Why this file exists

By Session 10 the codebase had grown organically — "campaign," "creative,"
"variant," "page," "placement" were used loosely and sometimes
interchangeably, across docs, code comments, and conversation. This produced
real confusion (multiple rounds of "wait, where does X actually live?").
This file is the single source of truth for what each term means and where
each concept lives, so every future session — and every human reading the
code — uses the same vocabulary.

**Rule: schema and code field names match this document's terminology.**
Not just doc language — `adUnits[]`, `placements[]`, etc. are real field
names in config/KV, not just descriptive prose. Consistency between what we
say and what the code calls it is the whole point.

---

## The Matcher — our auction mechanism, named

We do NOT run a legacy waterfall (sequential, first-to-meet-floor-wins) or
a generic RTB exchange. What we built is a two-stage, content-aware system
that doesn't map cleanly onto any single industry-standard term, so it has
its own name:

**"The Matcher"** — informal/conversational name.
**"Relevance-Weighted Auction with Dynamic Creative Resolution"** — full
formal name, for docs/pitch material where precision matters.

### Stage 1 — Relevance gate
Keyword scoring + Haiku filter. Eliminates campaigns that don't fit the
page's topic at all. This stage has no equivalent in waterfall or header
bidding — neither has a content-relevance pre-filter before the bid compare.

### Stage 2 — Relevance-Weighted Auction — PRECOMPUTED
Surviving campaigns are compared **simultaneously** (not sequentially) by
`effectiveCPM = cpmGBP × relevanceScore`. Highest effective CPM wins the
page. This is structurally closer to header bidding (everyone bids at once)
than legacy waterfall (sequential, early-exit) — confirmed in Session 10
research. **This stage IS precomputed** by the sweep (`api/precompute.js`),
which warms the `match:{urlHash}` KV cache ahead of real bot visits, so the
auction winner is typically already resolved before a real crawler arrives.

### Stage 3 — Dynamic Creative Resolution — separately cached, NOT precomputed
Once a campaign wins Stage 2, Haiku picks the single best-fitting Variant
from the winner's own Variant Bank, for that specific page. This is a
**second, separate selection step** — neither waterfall nor header bidding
choose creative dynamically per request at all; this is genuinely ours.

**Critical correction (Session 10):** this stage is NOT warmed by the
precompute sweep. It has its own cache (`variant:{urlHash|campaignId}`,
24h TTL) that is populated on first real request after a cache miss or
expiry. Comment in `lib/relevance.js` (search "should NOT be precomputed")
explains why: variant selection depends on live campaign state (the variant
bank can change between sweeps) and is deliberately excluded from the sweep.
**Do not assume Stage 3 is pre-warmed just because Stage 2 is.**

---

## Advertiser side

### Campaign
One per advertiser today (`advId` 1:1 with one Campaign). Carries:
`advId`, `advertiser` (name), `category`, `cpmGBP`, `budgetDailyGBP`,
`budgetTotalGBP`, `active`, plus `keywords` and `matchingDescription`
(used by Stage 1 relevance gate).

**No "Ad Group" layer.** This was explicitly considered and rejected in
Session 10 after research: AdWords' Campaign→Ad Group→Ad model exists to
bundle keyword bids, which doesn't map onto our content-relevance auction.
Native advertising platforms (Taboola, Teads/Outbrain) — the closer
real-world analogue to boop — use a flat Campaign→Creative model with no
Ad Group equivalent. Don't reintroduce this layer without re-litigating
that research.

### Variant Bank
The flat list of ad copy options belonging to one Campaign. 5-15 Variants,
enforced by `config.variantLimits`.

### Variant
`{ id, angle, text, focus? }`.
- `id` — **stable across saves** (fixed in Session 10 — `normalizeVariants`
  preserves existing ids, only assigns new ones to genuinely new variants;
  do not regress this, it broke Remove/Edit before the fix).
- `angle` — short internal label, not shown to end readers.
- `text` — the actual ad copy, max 280 chars, no em dashes (enforced via
  Creative Studio prompt + server-side regex backstop).
- `focus` — OPTIONAL free-text tag (e.g. "pension", "first-time-buyer").
  Organisational only — does NOT change matching logic. Lets an advertiser
  visually group their own variants without a rigid hierarchy.

### AI Creative Studio
A **separate drafting tool**, not part of the Campaign record. Takes 3
rough ideas, requires 2+ contain a real figure (input gate — refuses
before calling Haiku if not met), produces 2 fact-led + 1 promo variant.
Fact-led variants follow the "journalist, not copywriter" pattern (see
CONTINUE.md for the proven-vs-failed example pairs). Output only enters
the live Variant Bank when the advertiser clicks "Add to my variants" —
nothing from Creative Studio is live until that explicit action.

### Sections in the advertiser portal, in order
1. **AI Creative Studio** (drafting tool, top)
2. **Campaign** (the actual record), containing in order:
   - Settings (CPM, budgets, status, keywords, matching description)
   - Add a creative (manual single-variant entry)
   - Ad variants (the live Variant Bank — Edit, Remove, Top performer badge)
3. **Recent activity** (crawl log, scoped to this advId)

---

## Publisher side

### Placement
A named grouping of Ad Units for a publisher — e.g. "Finance Weekly —
Finance vertical." Maps to a `category` (finance/tech). Formalises what
was, pre-Session-10, the hardcoded `CATEGORY_PUBLISHERS` map in
`api/admin.js`.

### Ad Unit
One per page/article. Carries: `url`, `category`, `pubId`, current fill
status, last crawl time. Formalises what was, pre-Session-10, the
hardcoded `PUBLISHER_PAGES` list in `api/admin.js`.

**Precedent:** this mirrors Google Ad Manager's real Site → Ad Unit →
Placement hierarchy (researched Session 10) — well-established, lower-risk
to adopt than the rejected advertiser-side Ad Group idea, because it's
purely organisational/reporting, not a change to matching logic.

### Sections in the publisher portal, in order
1. Earnings/traffic cards
2. Ad serving — by page (per-Ad-Unit table: what's serving, which Variant)
3. Recent activity (crawl log, scoped to this pubId)

---

## Shared pattern: Recent Activity

Both portals have a "Recent activity" section. Same underlying crawl-log
data source (`recentBotLogs` / `recentMatches`), filtered differently:
advertiser side filters by `advId` (their campaigns only), publisher side
filters by `pubId` (their pages only). Treat this as one shared pattern
with two filters, not two separate features, when extending it.

---

## Explicitly out of scope (for now)

- **Per-Ad-Group budgets/CPM** — moot, since there's no Ad Group layer.
- **Operator/admin dashboard restructuring** — `/ui/admin` stays as the
  full, unscoped, see-everything view. Not touched by this naming/hierarchy
  work. A future session may formalise an operator-side Ad Unit/Placement
  cross-publisher view — not decided yet, flag if it comes up.
- **Multiple campaigns per advertiser** — schema technically allows it
  (`advId` could map to >1 campaign) but every advertiser has exactly one
  today. Don't build multi-campaign UI until this is actually needed.

---

## Cross-reference

- `CLAUDE.md` — why each architectural decision was made, file map.
- `CONTINUE.md` — proven-vs-failed Creative Studio examples, mistakes log.
- `HANDOVER.md` — current task state, immediate next steps.
- `VARIANT_BANK_SPEC.md` — pre-existing variant schema detail (Session 9-era;
  cross-check against THIS file if terminology conflicts — this file wins).
- `PRECOMPUTE_SPEC.md` — precompute sweep mechanics (Stage 2 of The Matcher).
