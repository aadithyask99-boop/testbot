# AI Ad Platform — Project Brain

> This file is the authoritative knowledge base for this project.
> Read this before touching any code. Update it when you make significant decisions.
> It lives alongside CONTINUE.md (learnings/mistakes), HANDOVER.md (current state/next tasks), and SESSION_LOG.md (historical).
>
> **Naming and hierarchy:** for canonical terminology (The Matcher, Variant Bank,
> Ad Unit, Placement, etc.) and where each concept lives in the advertiser/publisher
> portals, read PLATFORM_STRUCTURE_SPEC.md FIRST if you're touching anything in
> those portals or the matching pipeline. That file is the source of truth for
> naming — if anything below conflicts with it, PLATFORM_STRUCTURE_SPEC.md wins.

---

## What This Is

A server-side AI advertising platform that monetises AI traffic to publisher content across TWO surfaces from a single advertiser campaign:

**Surface A — Crawler Injection (live, Sessions 1-12).** When an AI crawler (Perplexity, ChatGPT Browse, Grok, Gemini, etc.) visits a publisher's page, the platform detects it, runs a **per-page contextual auction** (keyword pre-filter → Haiku precision filter → CPM ranking among approved survivors), and injects the winning sponsored paragraph into the HTML before delivery. Human visitors see the original unmodified page. The injected copy is data-led editorial prose — structurally identical to the publisher's content — that AI systems absorb as citable fact rather than flagging as advertising. Proven working: Session 9's ChatGPT Browse test showed data-led variants quoted verbatim as editorial fact.

**Surface B — Conversational Injection (planned, Sessions 13+).** A publisher building an AI product (chatbot, AI assistant) calls `POST /chat/query` with the user's message. The same Matcher pipeline runs on the query text. Returns a winning variant for the publisher to render as a "Sponsored" plain-text message. Editorial-first, not an ad card. See PLATFORM_STRUCTURE_SPEC.md Parts 21-25 and BUILD_PLAN.md for full architecture.

**Competitive positioning:** neither Oasy (crawl-time only) nor Thrad (query-time only) serves both surfaces from one campaign. This is boop's structural advantage. See PLATFORM_STRUCTURE_SPEC.md Part 21 for detailed competitive analysis.

The platform monetises on a CPM basis (CPC planned but deferred) with an 80/20 publisher/platform split.

**Live deployment:** https://testbot-two-psi.vercel.app  
**GitHub:** https://github.com/aadithyask99-boop/testbot  
**Dashboard:** https://testbot-two-psi.vercel.app/ui  
**Database:** Upstash Redis (KV_REST_API_URL + KV_REST_API_TOKEN env vars)  
**Anthropic API:** `claude-haiku-4-5` (ANTHROPIC_API_KEY env var)

---

## Why This Exists

Publishers are losing traditional ad revenue because AI systems are answering users' questions directly — fewer clicks through to publisher sites means fewer AdSense impressions. Google Network revenue fell 4% YoY as AI Overviews reduce click-through. This platform monetises the AI traffic that's *replacing* human traffic, rather than competing with it.

Core commercial insight: retrieval crawlers (Perplexity, ChatGPT Browse) visit pages right now to answer a user's live question. That injection has near-immediate effect on what the AI tells millions of users. That's worth real CPM. Training crawlers (GPTBot, ClaudeBot) are valued at 30% of retrieval CPM because they feed model training with 6-18 month lag.

---

## The Single Most Important Architectural Fact

**The auction fires at CRAWL time, not at query time.**

We never observe user queries. We act when an AI bot fetches the page. Our bet: what we inject at crawl time is what the model uses to answer a future query.

This shapes everything downstream:
- "Impression" = a confirmed bot crawl. Provable, atomic, billable.
- "Appearance in AI answer" = unobservable from our side. Needs publisher UTM data + advertiser cooperation to measure.
- The dashboard shows crawl events, NOT query events. Labelled honestly.
- Precompute architecture (planned Phase 2) makes sense precisely because crawls are independent moments — relevance determination doesn't need to be in the request path.

When you read "the live board updates in real time," that means real-time bot crawl events. Not real-time AI usage of injected content.

---

## Architecture: Why Each Decision Was Made

### Server-side injection only — not client-side
AI crawlers do not execute JavaScript. GPTBot, PerplexityBot, ClaudeBot all parse raw HTML only. A `<script>` injection would be invisible to them. The injection MUST happen in the HTTP response before HTML reaches the crawler.

`api/sdk.js` (client-side headless detection) is a placeholder for a future secondary layer. The primary path is fully server-side in `api/index.js`.

### Per-page auction, not single-creative
There is no single "current winner." Each page runs its own auction at crawl time. Trading 212 wins the ISA page while NordVPN wins the VPN page, simultaneously. The dashboard's "current creative" concept (Session 1 legacy) was a single-creative fossil — removed in Session 4 because in a multi-page world it was a phantom that lied. The dashboard reports what was logged; it never recomputes a winner.

### Hybrid matching (keyword + Haiku) — not pure ML, not pure keyword
The matching cascade in `lib/relevance.js`:
- **Layer 0**: KV cache (24h)
- **Layer 1**: publisher tag override (declarative `publisherCategory`)
- **Layer 2**: keyword scoring vs finance/tech taxonomy. Score ≥ 0.5 → confident, skip Haiku for page classification
- **Layer 3**: Haiku page classification (fallback: keyword guess if Haiku fails)
- **Layer 4a**: per-campaign keyword pre-filter (threshold 0.2)
- **Layer 4b (hybrid)**: when 2+ candidates survive Layer 4a, batched Haiku call decides which are actually relevant
- **Layer 5**: CPM auction among Haiku-approved survivors

Why hybrid: keyword alone can't tell E*TRADE (US broker) from a UK ISA campaign — both score equally on "isa/pension/investment" keywords. Haiku catches semantic mismatch. Pure-Haiku would cost too much per crawl and miss the obvious cases keyword nails in milliseconds. Keyword for the common case, Haiku for ambiguity.

Cost: ~£0.06 per ambiguous-page Haiku call. Cached 24h per (URL × candidate set). At demo scale, trivial; at publisher scale, also trivial.

### Strict mode on Haiku failure
When 2+ candidates pass keyword filter AND Haiku call fails (timeout, auth, model error): **serve nothing**. Don't fall back to keyword-only — that would risk wrong injection. Honest absence beats hopeful wrong ad. This is the policy that protects billing integrity at the matching layer.

### No cloaking for Googlebot/Bingbot — but fine for Perplexity/ChatGPT
Google's cloaking policy says "different content to human users and search engines." Perplexity, ChatGPT, Grok are NOT search engines — they have no webmaster guidelines or cloaking policy. So injecting for them is technically defensible. Googlebot and GoogleOther are excluded from injection (`cloakingRisk: true`) to protect publisher SEO. Bingbot is NOT excluded — we inject on it because Bing Copilot uses the Bing index.

### Plain `<p>` tag injection — no class, no comments
Tried `class="editorial-note"` and `<!-- sponsored -->` comments early on. Perplexity's quality ranking pipeline detected these as non-editorial content and downgraded the page. The injected paragraph must be structurally identical to every other paragraph on the page. Any fingerprint risks sanitisation.

### KV database over filesystem
Vercel serverless functions are stateless — filesystem writes don't persist between requests. All impression counts, creative data, click logs, match caches live in Upstash Redis. `lib/kv.js` wraps all Redis operations with silent error fallback so database issues never break publisher pages.

### Atomic hash operations for impression counting
Per-platform impression counts use `HINCRBY` via `kvHashIncr` — atomic at the database level. Earlier read-modify-write versions had concurrent-request race conditions that silently undercounted. Never use `kvJsonUpdate` for counters.

### 80/20 revenue share (publisher gets 80%)
Industry standards: Google AdSense 68%, Ezoic 80%, Publift 80%. To attract publishers away from Google, the minimum viable offer is 70%+. We chose 80/20 flat at launch. Volume-based tiers planned but not built.

### First-price waterfall auction — not real-time bidding
We deliberately chose NOT to build RTB. RTB requires millisecond infrastructure, multiple simultaneous bidders, complex bid management. Our model: advertisers set a static CPM, campaigns are filtered by relevance (Haiku-approved), then sorted by CPM descending, first campaign with budget remaining wins. Simpler, transparent to advertisers, correct for MVP scale.

### Random shuffle before CPM sort (under review)
`runAuctionFromList` shuffles before sorting to handle equal-CPM ties. This caused dashboard confusion in Session 4 (the phantom auction got a different shuffle than the real one). With the phantom removed, the shuffle is harmless — but a *deterministic* tiebreak (createdAt? alphabetic?) would be more honest. Open decision.

### Finance and Tech as initial ad categories
These are the *ad categories* we serve creatives for. A general news site is a valid publisher; only its finance and tech article pages will show creatives. Pages about sport, lifestyle etc. serve nothing (correctly returning `reason: 'other_category'` from `runMatch`).

### Vercel Hobby plan — 12 serverless function limit
Hard limit. Currently using 8/12. Never add a new file without checking this. Consolidations made (Session 1): health+robots+sitemap+ping → utils.js, ad.js → folded into admin.js, BingSiteAuth.js removed. Four slots remain.

### Variant bank (planned Session 5) — NOT free-form generation
Each campaign gets 5-15 approved variants with distinct angles ("first-home" / "pension-consolidation" / "ISA" / etc.). Haiku SELECTS the best variant per page from approved copy. NEVER writes new copy.

**Hard constraint (FCA compliance):** generation creates new claims; new claims need compliance approval; AI cannot make compliance decisions. Selection from approved copy is approved copy. This rule is non-negotiable for the finance category. Same constraint pre-emptively applied to tech.

---

## File Map (current as of end of Session 10)

> For full architecture, KV schema, and naming: see PLATFORM_STRUCTURE_SPEC.md

```
api/
  index.js         Main handler: bot detection → runMatch → injection → impression logging.
  admin.js         Campaign CRUD, AI Creative Studio, manual crawl, auto-crawl, seed, reindex.
  dashboard.js     Analytics API: 3 views (operator/advertiser/publisher) with advId/pubId scoping.
  dashboard-ui.js  Visual UI: chooser, admin, scoped advertiser/publisher portals. STRING CONCAT ONLY.
  click.js         /click redirect + ad click tracking.
  sdk.js           Client-side publisher snippet (placeholder — real SDK = Cloudflare Worker).
  utils.js         /health + /robots.txt + /sitemap.xml + /ping.
  match.js         POST /match for Worker contextual matching calls.
  precompute.js    Category classification sweep (Stages 0-3 of The Matcher).
  impression.js    Revenue tracking with 80/20 split, atomic tenths-of-pence.

lib/
  detector.js      40+ AI crawler UA patterns.
  combined-detector.js  Three-layer: UA → behavioural → anonymous crawler (DeepSeek).
  behavioural.js   Header signal scoring.
  injector.js      HTML injection: plain <p>, no fingerprints, absolute click URLs.
  kv.js            Upstash Redis wrapper (kvGet/kvSet/kvIncr/kvIncrBy/kvHashIncr/kvDel + more).
  referrer.js      AI platform referrer detection, 14 platforms.
  config.js        Categories, publishers (with slugs), advertisers (with slugs), variantLimits.
  auction.js       effectiveCPM = cpmGBP × relevanceScore, budget checks, spend tracking.
  relevance.js     The Matcher — 8-stage pipeline. See PLATFORM_STRUCTURE_SPEC.md §3.
  demo-pages.js    Empty stubs (real pages on publisher sites).

worker/index.js    Cloudflare Worker proxy for publisher sites.
variant_payloads/  Campaign JSON files for batch upload (camp_002 through camp_015).
```

## KV Data Schema

```
# Campaign data
campaign:{id}                              Object — full campaign (incl matchingDescription)
campaigns:finance                          Array — campaign IDs in finance category
campaigns:tech                             Array — campaign IDs in tech category

# Impressions (atomic, per-campaign)
impr:retrieval:{id}:total                  Integer
impr:training:{id}:total                   Integer
impr:by_camp_plat:{id}                     Hash {platform: count}

# Spend (atomic)
spend:daily:{id}:{YYYY-MM-DD}              Integer
spend:total:{id}                           Integer

# Aggregate stats
stats:impressions:total                    Integer
stats:impressions:date:{YYYY-MM-DD}        Integer
stats:impressions:type:retrieval           Integer
stats:impressions:type:training            Integer
stats:impr_by_platform                     Hash
stats:clicks:total                         Integer  (publisher click)
stats:click_by_platform                    Hash
stats:unique_clicks:total                  Integer
stats:uniq_click_by_platform               Hash
stats:adclicks:total                       Integer  (advertiser link click)
stats:bot_visits:total                     Integer  (all bot visits — denominator for fill rate)
stats:bot_served:total                     Integer  (bot visits where we actually injected)

# Match caching (Session 3+)
match:{sha256(url)}                        {category, method, classifiedAt}      24h TTL — page classification
match-rel:{sha256(url|sorted-ids)}         {survivorIds, decidedAt}              24h TTL — per-candidate-set relevance

# Sessions
session:click:{IP}                         '1' with 300s TTL — unique click dedup

# Logs (LPUSH-trimmed lists, last 100)
log:recent                                 Bot impressions (incl URL, candidates breakdown, match metadata)
log:clicks                                 Publisher click events
log:adclicks                               Advertiser destination clicks
```

---

## Crawler Detection: What Works and What Doesn't

**Reliably detected (self-identifying):**
PerplexityBot, Perplexity-User, ChatGPT-User, GPTBot, ClaudeBot, Claude-User, Bingbot, Meta-ExternalFetcher, Google-Agent, Gemini-Deep-Research, Google-NotebookLM, xAI-Bot, DuckAssistBot, MistralAI-User, and ~30 more.

**Detected via anonymous crawler path (no published UA):**
DeepSeek and similar. Chrome UA + missing browser proof headers (Accept-Language, sec-ch-ua, sec-fetch-mode) = anonymous crawler, 75% confidence.

**Intentionally excluded from injection (cloakingRisk):**
Googlebot, GoogleOther — detected and logged, but injection skipped. SEO cloaking-policy guard.

**Grok's browse tool** — uses a spoofed iPhone Safari UA with full browser headers. Our detector correctly classifies as human. Grok's live browse gets the clean page. xAI-Bot (background indexer) IS detected and injected on. Net result: Grok responses lag by xAI-Bot recrawl cycle (~24-72hr). Acceptable; documented to advertisers.

**Meta AI, Gemini, DeepSeek** — often answer from search indexes rather than live fetches. Index propagation lag means newly-updated creatives take 24-72h. Property of how those systems work; not a bug in our detection.

---

## Revenue Model

```
Advertiser pays:    stated CPM (gross)
Publisher gets:     80% of gross CPM × impressions / 1000
Platform gets:      20% of gross CPM × impressions / 1000

Dashboard revenue calc (dashboard.js):
  campaignCPM = currentCreative.cpmGBP || 18
  revenueGBP = ((retrieval × campaignCPM) + (training × campaignCPM × 0.3)) / 1000

Training impressions billed at 30% of retrieval — lower commercial value, delayed effect.
Publisher floor price: planned, not built (Session 7).
```

---

## What's Proven vs What's Demo

**Proven (with evidence):**
- Bot detection across 40+ crawlers, including anonymous crawler path (DeepSeek)
- HTML injection invisible to humans — confirmed across GPTBot, Perplexity, Grok, Gemini, Meta AI, Claude
- Per-page contextual auction with hybrid relevance filter (keyword + Haiku)
- Multi-campaign competition: 3 Trading 212 campaigns competing correctly (ISA £10, Stocks ISA £14, CFD £18), relevance gate correctly separates them by page topic
- Haiku correctly filters cross-topic mismatches (CFD on ISA pages, smartphone on VPN articles, E*TRADE US-broker on UK ISA)
- Pause/activate toggle: pausing camp_016 → camp_006 takes ISA page (real auction, not defaulting) → reactivating → camp_016 immediately retakes
- Brand-mention validation gate (Session 12) — server-side enforcement that at least one non-promo variant names the advertiser
- Data-led copy cited as editorial fact (Session 9: AJ Bell stats quoted verbatim by ChatGPT Browse; promotional copy flagged as "a promotional callout")
- Variant selection: Haiku picks topic-matched variants per page (ETF variant on ISA page, forex variant on trading page), rotation across crawls
- Atomic impression + spend tracking under concurrent load, 80/20 split
- Precompute: 10/10 page coverage, event-based invalidation on campaign save/pause/delete
- KV parallelization: 16.7x speedup on dashboard responses (Session 11)
- Multi-campaign support in advertiser portal: dropdown switcher, Add/Delete campaign
- AI Creative Studio: 3 ideas → 2 fact-led + 1 promo, input gate, output traceability
- Budget cap logic correct (£0.01 cap passes at zero spend — blocks on impression #2)

**Still demo/placeholder:**
- Publisher pages are demo articles (Finance Weekly, Tech Briefing — zero domain authority)
- No real publisher partner — all testing via direct URL injection
- Click tracking (`/click`) exists but click data invisible to advertisers
- No trackable links — see BUILD_PLAN.md Track 1 (approved, next to build)
- No conversational surface — see BUILD_PLAN.md Track 2 (approved, after Track 1)
- No prompt monitoring — see BUILD_PLAN.md Track 3 (planned, after Track 2)
- CPC pricing not built (deferred until click data validates)
- Spend sparkline uses simulated variance, not real daily historical data (real chart infrastructure built, just no data yet)
- No real auth — portal access is URL-based only

---

## Environment Variables Required

```
KV_REST_API_URL         Upstash Redis REST URL (set by Vercel-Upstash integration)
KV_REST_API_TOKEN       Upstash Redis token (set by Vercel-Upstash integration)
ANTHROPIC_API_KEY       For Haiku calls in lib/relevance.js. Reachable via /health diagnostic.
PLATFORM_URL            Optional. Used in injector.js for click tracking URLs.
                        Defaults to https://testbot-two-psi.vercel.app
VERCEL_REGION           Auto-set by Vercel. Used in /health response only.
```

---

## Active Constraints

1. **Vercel Hobby: 12 serverless function limit.** Currently 8/12. Check before adding files.
2. **No GTM/client-side injection for real crawlers.** Real AI bots don't execute JS. Server-side only.
3. **Googlebot/GoogleOther must never receive injected content.** `cloakingRisk` flag enforces.
4. **Haiku model name is `claude-haiku-4-5`** — NOT 3.5. The 3.5 snapshot was retired by Anthropic on 2026-02-19. If you change the model name, test against the live API first.
5. **Strict mode on ambiguous Haiku failure.** Serve nothing rather than risk wrong ad.
6. **FCA compliance: no free-form ad copy generation.** Variant selection only (when variants are built).
7. **Per-page auction logged ONCE.** Injection and logging use the same resolved winner. The dashboard never re-derives.
8. **Browser-JS parse gate is mandatory** on every dashboard-ui.js edit. See "the parse gate" section below.
9. **Upstash free tier: 500k commands/month.** Plenty for current scale. Monitor if impression volume grows significantly.
10. **`requestsPerMinute` is always 1** in calls to behavioural detection. Rate signal removed. Don't put it back without a clear reason.

---

## The Parse Gate (do not skip this — ever)

`api/dashboard-ui.js` is a serverless function that returns HTML containing inline `<script>` browser JS. The browser JS is built via string concatenation. It's a footgun: the page can return HTTP 200 with broken inline JS, and everything stays "Loading..." silently. We've been burned by this multiple times.

After ANY edit to `api/dashboard-ui.js`, run:

```bash
node /tmp/render-ui.js > /dev/null 2>&1 && node --check /tmp/dash-inline.js && echo "✓✓✓ INLINE BROWSER JS PARSES"
```

`/tmp/render-ui.js` invokes the dashboard handler and writes both `dash.html` (the rendered HTML) and `dash-inline.js` (the extracted browser JS). `node --check` validates the JS parses without executing it. If you don't have these scripts in `/tmp/`, recreate them — they're trivial.

ALSO verify that the elements you added are actually present:

```bash
grep -q 'id="live-board"' /tmp/dash.html && echo "✓ live-board present"
grep -q 'id="f-desc"' /tmp/dash.html && echo "✓ targeting field present"
```

If the parse gate fails after an edit, the most common cause is template-literal contamination — using backticks inside concatenation, or missing escaping on a single quote inside HTML. Diff against the previous working version.

---

## The Honest Diagnostic Test Cycle

When something looks wrong in production:

1. **Curl the raw response** — does the bot actually receive what you think it does?
   ```bash
   curl -s -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" \
     https://testbot-two-psi.vercel.app/articles/best-isa-2026
   ```

2. **Curl the dashboard payload** — what does the system think happened?
   ```bash
   curl -s "https://testbot-two-psi.vercel.app/dashboard?view=advertiser" | python3 -m json.tool > /tmp/payload.json
   ```
   Then read the `pageBoard` for the URL. Each card shows the full candidate breakdown — who competed, who won, who was filtered, by what method, at what time.

3. **Curl `/match` directly** — bypass the bot path and test matching in isolation:
   ```bash
   curl -X POST https://testbot-two-psi.vercel.app/match \
     -H "Content-Type: application/json" \
     -d '{"url":"...","title":"...","metaDescription":"...","firstParagraph":"..."}'
   ```

4. **Curl `/health`** — is the environment correct?
   ```bash
   curl -s https://testbot-two-psi.vercel.app/health | python3 -m json.tool
   ```
   Should show `anthropic_key_set: true`, `kv_url_set: true`, `kv_token_set: true`.

5. **Then read the logs from the response payload.** Don't redesign anything until the data has told you what actually went wrong.

The Live Auction Board exists to make Step 2 visual. Step 2 is usually all you need.

---

## Documents

This project has six Markdown docs that act as memory across sessions:

- **CLAUDE.md** (this file) — the project brain. What the system is, why decisions were made, current constraints.
- **CONTINUE.md** — lessons, mistakes, hard-won knowledge. Read this BEFORE writing code.
- **HANDOVER.md** — current state and next tasks. Read this FIRST when picking up work.
- **SESSION_LOG.md** — historical record of what happened in each session.
- **BUILD_PLAN.md** — approved build plan for Sessions 13+. Trackable links, conversational surface, query insights. File-level changes, build order, verification steps.
- **CLAUDE.local.md** — session protocol for Claude Code. How to start/end sessions.

Architecture and naming:
- **PLATFORM_STRUCTURE_SPEC.md** — canonical naming, architecture, portal structure, KV schema, competitive differentiation (Parts 21-25 added Session 12).

These are the brain of the project. A new session reading all of them should be able to (1) understand exactly what was built and why, (2) know what to work on next, (3) not repeat mistakes already made, (4) continue seamlessly. Keep them accurate. Keep them honest. The docs are only useful if they reflect reality.
