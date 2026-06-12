# WORKER_SDK_SPEC.md — Session 7 Design Doc

> Spec first, code after — same process as previous sessions.

---

## What This Is

A Cloudflare Worker script that a publisher pastes into their CF dashboard,
attached to their domain (or a specific route). It sits in front of their
existing site — NO changes to their origin server. For each request:

1. Fetch the origin response (pass-through to their real server)
2. Check the User-Agent against an embedded list of high-confidence AI
   crawler patterns
3. **If bot AND not cloaking-risk (Googlebot/GoogleOther excluded):**
   extract page signals from the fetched HTML (title, meta description,
   first paragraph), call `POST /match` on our platform, get back a winner
   + selected variant, inject the variant's `<p>` into the HTML
4. **If human, or cloaking-risk bot:** return the response completely
   unmodified
5. Fire-and-forget an impression log call (don't block the response on this)

This is `api/index.js`'s logic, restructured for "fetch someone else's page"
instead of "serve our own demo page from `lib/demo-pages.js`."

---

## Test Target: testbot-two-psi itself (confirmed)

Per Aadi: prove the mechanism by pointing the Worker at our OWN demo pages
first — i.e., the Worker's "origin" IS testbot-two-psi.vercel.app, and the
Worker calls `/match` on the SAME deployment. This means:

- The Worker can be deployed on a Cloudflare Workers free-tier subdomain
  (e.g. `testbot-worker.{account}.workers.dev`) with a route/binding that
  proxies to `https://testbot-two-psi.vercel.app/*`
- Visiting the Worker's URL for `/articles/best-isa-2026` should show the
  SAME injected content as visiting testbot-two-psi directly — proving the
  Worker's injection produces an equivalent result to the existing
  server-side injection in `api/index.js`
- Once proven, generalizing to a REAL publisher is just changing the origin
  URL the Worker fetches from — the bot-detection, `/match` call, and
  injection logic are unchanged

**This is also a genuinely useful artifact regardless of outcome**: if it
works, it's the literal thing to hand a prospective publisher ("install
this, point it at your domain, change one line"). If it reveals problems
(CPU time limits, header issues, streaming complications), we learn that
on OUR infrastructure before a publisher's site is on the line.

---

## Bot Detection: Embedded Pattern Subset (confirmed)

**Decision:** embed a generated subset of `lib/detector.js`'s patterns
directly in the Worker script, rather than calling back to our API to ask
"is this a bot?" on every request.

**Why:** the Worker sits in front of a publisher's ENTIRE site. Most traffic
is human. A detection round-trip to Vercel on every human pageview adds
latency to 100% of a publisher's traffic to serve <1% of it (bots) — the
opposite of what an edge worker is for. Embedding a regex/string check is
microseconds of CPU time, well within Cloudflare's free-tier budget
(10ms CPU time per request on free tier — a UA string match against ~20
patterns is far below this).

**What gets embedded — v1 scope:**
Only the SELF-IDENTIFYING, high-confidence crawlers from `AI_CRAWLERS` in
`lib/detector.js` — i.e., entries with simple `patterns: ['SomeBot']` string
matches and `cloakingRisk` flags. This covers the crawlers that matter
commercially: PerplexityBot, ChatGPT-User, Bingbot/BingPreview, GPTBot,
ClaudeBot, Claude-User, Google-Extended, Googlebot (cloaking-risk →
excluded), GoogleOther (cloaking-risk → excluded), and similar.

**Deferred to v2 (NOT in this session):**
- `lib/combined-detector.js`'s behavioral scoring (missing headers, etc.)
- Anonymous crawler detection (DeepSeek's Chrome-UA-no-headers pattern)
- `lib/behavioural.js`'s scoring entirely

These require either richer signal collection at the edge (multiple header
checks, scoring logic) or are inherently probabilistic — appropriate for
v2 once v1's simple self-identifying-bot path is proven. v1 will miss
DeepSeek-style anonymous crawlers; this is an acceptable, documented gap,
not a silent one.

### Generation script (not full CI — a manual-run helper)
`scripts/generate-worker-detector.js` (new, small): reads
`lib/detector.js`'s `AI_CRAWLERS` array, filters to entries with simple
string `patterns` (no regex, no behavioral-only entries), and emits a JS
array literal `[{name, patterns, type, cloakingRisk}, ...]` formatted for
direct paste into the Worker script's `BOT_PATTERNS` constant.

**Process:** run manually whenever `detector.js`'s self-identifying crawler
list changes meaningfully (new major AI crawler added). Output gets pasted
into `worker/index.js`. Documented as a manual step in `CONTINUE.md` —
not automated, but not hand-maintained from scratch either.

---

## /match endpoint changes (api/match.js)

Mostly already works (confirmed live this session — returns `winner` with
full campaign + `selectedVariant` + `variantId`). One addition needed:

- Accept `bodySample` in the request body (currently only `firstParagraph`
  is read) — `runMatch`'s relevance filter and variant selection use
  `bodySample` for richer context. The Worker will send both.

No other changes to `/match` — it already returns everything the Worker
needs: `winner.advSlug`, `winner.link`, `winner.linkText` (for constructing
the `/click` tracking URL), and `selectedVariant.text` (the string to
inject).

---

## Injection Logic (Worker-side, mirrors lib/injector.js)

`lib/injector.js` finds the 2nd `</p>` after 200 chars and inserts a plain
`<p>` tag, falling back to before `</body>`. The Worker needs equivalent
logic operating on the FETCHED HTML STREAM/TEXT.

**Approach:** Cloudflare Workers' `HTMLRewriter` API is purpose-built for
this — it can stream-transform HTML without buffering the whole response,
matching on CSS-selector-like element handlers. Plan:
- `HTMLRewriter` handler on `p` elements — track paragraph count, and on
  the 2nd `<p>`, use `element.after(injectedHtml, {html: true})` to insert
  the sponsored paragraph immediately after it
- Fallback: if fewer than 2 `<p>` elements exist on the whole page, a
  handler on `body` inserts before `</body>` (mirrors `lib/injector.js`'s
  fallback)
- The injected `<p>` is PLAIN — no class, no comment — same
  no-fingerprinting rule from CLAUDE.md/CONTINUE.md applies identically
  here

**Click tracking:** `selectedVariant.text` itself has no link — the
existing pattern (per `lib/injector.js`) appends a tracking link separately
via `PLATFORM_URL`. The Worker constructs:
`{PLATFORM_URL}/click?adv={winner.advSlug}&dest={encodeURIComponent(winner.link)}`
and appends as `<a>` text or wraps the injected paragraph, matching
`lib/injector.js`'s existing format. (`lib/injector.js`'s exact current
output format should be checked and matched exactly — re-verify during
build, don't assume.)

---

## Impression Logging

`api/index.js` currently logs impressions via direct KV writes
(`kvHashIncr`, `kvListPush`, etc.) inside the same request. The Worker can't
write to Upstash directly (different credentials/security boundary) — it
needs an HTTP endpoint.

**Options considered:**
1. New `POST /impression` endpoint — Worker calls this fire-and-forget
   (`ctx.waitUntil(fetch(...))` so it doesn't block the response)
2. Reuse `/match` itself to also log — conflates "decide" with "record",
   and `/match` may be called speculatively/cached without a real
   impression occurring

**Decision: Option 1, but DEFER to a follow-up within this session if time-
constrained.** For the v1 proof-of-concept (Worker fetching our OWN demo
pages), impressions logged via the EXISTING path (`api/index.js` already
logs when ITS OWN bot-path fires) would DOUBLE-COUNT if the Worker also
logs — because the Worker fetches FROM testbot-two-psi, and if THAT fetch
also looks like a bot to `api/index.js` (it might, if the Worker's fetch
doesn't set a browser-like UA), `api/index.js` logs an impression too, AND
the Worker logs its own.

**For the proof-of-concept phase specifically:** the Worker's fetch to the
origin should use a NORMAL/HUMAN-like UA (or a dedicated
`User-Agent: TestbotWorker/1.0` that `lib/detector.js` does NOT classify as
a bot/training/retrieval crawler) — so `api/index.js` serves the CLEAN,
UNMODIFIED page to the Worker (no double injection, no double logging), and
the WORKER is the sole injector + logger for ITS visitors. This cleanly
separates "Worker's bot detection of ITS visitors" from "origin's bot
detection of the Worker's own fetch."

`POST /impression` (new): `{campaignId, variantId, platform, crawlerType,
url}` → same KV writes `api/index.js` currently does inline
(`kvIncr`, `kvHashIncr` × several, `kvListPush('log:recent', ...)`). Could
be folded into `api/match.js` as a second action
(`POST /match?action=impression`) to avoid a new function slot — TBD at
build time depending on slot pressure (currently 9/12, 3 free, so a new
slot is affordable either way).

---

## Build Order

1. `scripts/generate-worker-detector.js` — generate the embedded pattern
   list from `lib/detector.js`
2. `api/match.js` — accept `bodySample` in request body
3. `worker/index.js` — new directory, the actual Worker script:
   - embedded `BOT_PATTERNS` (from step 1's output)
   - fetch origin (testbot-two-psi.vercel.app, hardcoded for v1 — becomes
     configurable for a real publisher later)
   - UA check → bot? cloaking-risk?
   - if bot: extract title/meta/first-`<p>`/body-sample via HTMLRewriter,
     call `/match`, get winner+variant
   - HTMLRewriter injection (2nd `<p>`, fallback before `</body>`)
   - click-tracking link construction (match `lib/injector.js` format)
   - impression logging call (`ctx.waitUntil`, fire-and-forget)
4. `POST /impression` (or `/match?action=impression`) — new/extended
   endpoint for Worker-side logging
5. Deploy Worker to a `*.workers.dev` subdomain, point at
   testbot-two-psi.vercel.app
6. Test: crawl the Worker's URL as PerplexityBot, compare output to crawling
   testbot-two-psi directly as PerplexityBot — should show equivalent
   injected content
7. Test: crawl as Googlebot — Worker should pass through unmodified
   (cloaking-risk respected)
8. Test: human UA — unmodified, no `/match` call, no impression log
9. Dashboard: confirm Worker-sourced impressions appear correctly
   (platform/crawlerType attribution — Worker should report the REAL
   visitor's UA-derived platform, not "TestbotWorker")

---

## Open Items Confirmed

- Endpoint: `/match` (existing, no new slot) becomes the Worker's decision
  endpoint — confirmed working live this session.
- Bot detection: embedded pattern subset (self-identifying crawlers only,
  v1), generated from `lib/detector.js` via a manual-run script — confirmed.
- Test target: Worker fetches testbot-two-psi.vercel.app itself, proving
  the mechanism before any real publisher — confirmed.
- Impression logging: new endpoint (slot-affordable at 9/12), Worker's own
  origin-fetch UA must NOT be bot-classified by `api/index.js` to avoid
  double-counting during the proof-of-concept phase.
