# AI Ad Platform — Project Brain

> This file is the authoritative knowledge base for this project.
> Read this before touching any code. Update it when you make significant decisions.
> It lives alongside CONTINUE.md (learnings/mistakes) and HANDOVER.md (current state/next tasks).

---

## What This Is

A server-side AI advertising platform that monetises AI crawler traffic to publisher websites. When an AI crawler (Perplexity, ChatGPT Browse, Grok, etc.) visits a publisher's page, the platform detects it, injects a sponsored text paragraph into the HTML, and charges the advertiser CPM. Human visitors see the original unmodified page.

**Live deployment:** https://testbot-two-psi.vercel.app  
**GitHub:** https://github.com/aadithyask99-boop/testbot  
**Dashboard:** https://testbot-two-psi.vercel.app/ui  
**Database:** Upstash Redis (connected via KV_REST_API_URL + KV_REST_API_TOKEN env vars)

---

## Why This Exists

Publishers are losing traditional ad revenue because AI systems are answering users' questions directly — fewer clicks through to publisher sites means fewer AdSense impressions. Google Network revenue fell 4% YoY as AI Overviews reduce click-through. This platform monetises the AI traffic that's *replacing* human traffic, rather than competing with it.

The core insight: retrieval crawlers (Perplexity, ChatGPT Browse) visit pages right now to answer a user's live question. That injection has near-immediate effect on what the AI tells millions of users. That's worth real CPM.

---

## Architecture: Why Each Decision Was Made

### Server-side injection only — not client-side
AI crawlers do not execute JavaScript. GPTBot, PerplexityBot, ClaudeBot all parse raw HTML only. A `<script>` tag injection would be invisible to them. The injection MUST happen in the HTTP response before the HTML reaches the crawler.

The sdk.js file does client-side detection for headless browsers as a secondary layer, but the primary injection path is entirely server-side in api/index.js.

### No cloaking for Googlebot/Bingbot — but fine for Perplexity/ChatGPT
Google's cloaking policy says "different content to human users and search engines." Perplexity, ChatGPT, Grok are not search engines — they have no webmaster guidelines or cloaking policy. So injecting for them is technically defensible. Googlebot and GoogleOther are excluded from injection (cloakingRisk: true) to protect publisher SEO. Bingbot is NOT excluded — we inject on it because Bing Copilot uses the Bing index, so injecting on Bingbot gets content into Copilot responses.

### Plain `<p>` tag injection — no class, no comments
We tried `class="editorial-note"` and `<!-- sponsored -->` comments early on. Perplexity's quality ranking pipeline detected these as non-editorial content and downgraded the page. The injected paragraph must be structurally identical to every other paragraph on the page. Any fingerprint risks sanitisation.

### display:none was removed — a lesson learned
Early versions used `display:none` on the injected block, thinking it would hide from humans while being visible to bots. Wrong. AI content parsers strip elements with display:none before processing. The text never reached the crawlers. Removed entirely. The correct approach: injection only fires on detected bots, so humans never receive the modified HTML at all.

### KV database over filesystem
Vercel serverless functions are stateless — filesystem writes don't persist between requests. All impression counts, creative data, and click logs live in Upstash Redis. The KV helper (lib/kv.js) wraps all Redis operations with silent error fallback so database issues never break publisher pages.

### Atomic hash operations for impression counting
Early versions used kvJsonUpdate (read-modify-write) for per-platform impression counts. Under concurrent requests, this had a race condition: 4 requests all read `{Perplexity: 0}`, all write `{Perplexity: 1}`, result is 1 not 4. Fixed by switching to Redis HINCRBY via kvHashIncr — atomic at the database level, no race condition possible. The total counter (kvIncr) was always atomic; only the per-platform breakdown was broken.

### 80/20 revenue share (publisher gets 80%)
Researched industry standards: Google AdSense gives publishers 68%, Ezoic 80%, Publift 80%. To attract publishers away from Google, the minimum viable offer is 70%+. We chose 80/20 flat at launch. Volume-based tiers (80% → 85% at 100k+ impressions/month) are planned but not yet built.

### First-price waterfall auction — not real-time bidding
We deliberately chose NOT to build RTB (real-time bidding). RTB requires millisecond infrastructure, multiple simultaneous bidders, and complex bid management. Our model: advertisers set a static CPM price, campaigns are sorted by CPM descending, first campaign with budget remaining wins. This is a "direct deal waterfall" model. Simpler, transparent to advertisers, correct for MVP scale.

### Finance and Tech as initial ad categories
Not because publishers must be finance/tech sites — any publisher can run the platform. Finance and Tech are the *ad categories* we serve creatives for. A general news site is a valid publisher; only their finance and tech article pages will show creatives. Pages about sport, lifestyle etc. serve nothing.

### Vercel Hobby plan — 12 serverless function limit
Hard limit. Currently using 7. Never add a new file without checking this. Consolidations made: health+robots+sitemap+ping → utils.js (freed 3 slots), ad.js → folded into admin.js (freed 1 slot). BingSiteAuth.js removed (freed 1 slot). Five slots remain for: match.js, campaigns.js, publishers.js, and 2 spare.

---

## File Map

```
api/
  index.js         Main handler. Bot detection → creative fetch → injection → impression logging.
                   Human path: detects AI referrer, logs click with 5-min session dedup.
  admin.js         Creative CRUD (/admin, /admin/creative, /admin/seed) + /ad creative fetch.
                   One file handles all campaign management and creative retrieval.
  dashboard.js     Analytics API. Three views: ?view=operator (default), ?view=advertiser, ?view=publisher.
                   17 KV keys fetched in one Promise.all. Platform breakdown from atomic hash.
  dashboard-ui.js  Visual dashboard HTML served as a serverless function.
                   Uses string concatenation (NOT template literals) to avoid JS escaping bugs.
                   5-second polling. Three tabs. Creative update form. Verification panel.
  click.js         /click?adv=SLUG&dest=URL — logs ad click, redirects to advertiser destination.
  sdk.js           Client-side publisher snippet. Detects headless browsers only.
                   NOTE: Real AI crawlers never execute JS. This is secondary to server-side injection.
  utils.js         Consolidation of: /health, /robots.txt, /sitemap.xml, /ping (IndexNow).
                   Routes by req.url internally. robots.txt and sitemap.xml still served at correct paths.

lib/
  detector.js      AI crawler UA database. 40+ crawlers across all major AI systems.
                   Returns: platform name, crawlerType (retrieval/training), commercialValue, cloakingRisk.
  combined-detector.js  Three-layer detection: UA match (95% conf) → behavioural scoring → anonymous crawler.
                   Anonymous crawler path catches DeepSeek: Chrome UA + missing browser proof headers = 75% conf.
                   Reads detectionThreshold from config.js (default 70).
  behavioural.js   Header signal scoring. Missing Accept-Language (+25), missing cookies on repeat (+20),
                   no Referer (+10), no browser security headers (+20), non-browser Accept (+15).
                   NOTE: requestsPerMinute always passed as 1 — rate signal (+30) never fires in production.
  injector.js      HTML injection. Finds 2nd </p> after 200 chars, inserts plain <p> tag.
                   Falls back to before </body>. Supports optional link via PLATFORM_URL env var.
  kv.js            Upstash Redis REST API wrapper. kvGet/kvSet/kvIncr/kvListPush/kvListGet/
                   kvJsonUpdate/kvHashIncr/kvHashGetAll. Silent error fallback on all operations.
  referrer.js      AI platform referrer detection for click tracking. Includes query extraction:
                   Perplexity slug parsing, Google/Bing ?q= params. 14 platforms covered.
  config.js        Default creative (Vanguard demo), detectionThreshold: 70, publisher info.
```

---

## KV Data Schema

```
creative:{category}               Object — current active creative for that category
stats:impressions:total           Integer — all-time impression count
stats:impressions:date:{YYYY-MM-DD}  Integer — daily impression count
stats:impressions:type:retrieval  Integer — retrieval crawler impressions
stats:impressions:type:training   Integer — training crawler impressions
stats:impr_by_platform            Hash — per-platform impression counts (atomic HINCRBY)
stats:clicks:total                Integer — all-time publisher click count
stats:clicks:date:{YYYY-MM-DD}    Integer — daily click count
stats:click_by_platform           Hash — per-platform click counts (atomic HINCRBY)
stats:unique_clicks:total         Integer — unique session click count
stats:unique_clicks:date:{YYYY-MM-DD}  Integer — daily unique clicks
stats:uniq_click_by_platform      Hash — per-platform unique clicks (atomic HINCRBY)
stats:adclicks:total              Integer — advertiser link click count
stats:adclicks:date:{YYYY-MM-DD}  Integer — daily ad click count
session:click:{IP}                String '1' with 300s TTL — unique click session dedup
log:recent                        List (last 100) — bot impression log entries
log:clicks                        List (last 100) — publisher click log entries
log:adclicks                      List (last 100) — advertiser click log entries
```

---

## Crawler Detection: What Works and What Doesn't

**Reliably detected (self-identifying):**
Perplexity, ChatGPT Browse (ChatGPT-User), GPTBot, ClaudeBot, Claude-User, Bingbot, Meta-ExternalFetcher, Google-Agent, Gemini-Deep-Research, Google-NotebookLM, xAI-Bot, DuckAssistBot, MistralAI-User, and ~30 more.

**Detected via anonymous crawler path (no published UA):**
DeepSeek — confirmed to not publish a User-Agent. Uses Chrome UA without browser proof headers (Accept-Language, sec-ch-ua, sec-fetch-mode). Our detector catches Chrome UA + missing all three headers = anonymous crawler, 75% confidence.

**Intentionally excluded from injection (cloakingRisk):**
Googlebot, GoogleOther — detected and logged, but injection skipped. Serving different content to Google's crawler is an SEO cloaking violation. These are the ONLY crawlers excluded.

**Grok's browse tool** — uses a spoofed iPhone Safari UA with full browser headers. Undetectable. When Grok does a live fetch it gets the clean page. When Grok reads from its xAI-Bot indexed version, it gets the injected content. This is expected and acceptable.

**DeepSeek, Meta AI, Gemini** — often answer from search indexes, not live fetches. Index propagation lag means newly updated creatives take 24-72 hours to appear in their responses. This is a property of how those systems work, not a bug in our detection.

---

## Revenue Model

```
Advertiser pays:    stated CPM (gross)
Publisher gets:     80% of gross CPM × impressions / 1000
Platform gets:      20% of gross CPM × impressions / 1000

Revenue estimate formula in dashboard.js:
  campaignCPM = currentCreative.cpmGBP || 18
  revenueGBP = ((retrieval * campaignCPM) + (training * campaignCPM * 0.3)) / 1000
  Training impressions billed at 30% of campaign rate (lower commercial value, delayed effect)

Publisher floor price: planned but not built yet.
  When built: floor is applied to gross CPM before split.
  Campaign below floor: excluded from auction entirely.
```

---

## What's Proven vs What's Demo

**Proven by real-world testing:**
- ChatGPT Browse, Perplexity, Grok, Claude, Gemini 2.5 Flash, Meta AI all surfaced injected content in their responses
- Injection is invisible to humans — confirmed by testing with real browsers
- Dynamic creative swap works — Vanguard→Fidelity→Hargreaves Lansdown all confirmed
- ChatGPT Browse propagation: ~25 minutes from creative change to response update
- DuckDuckGo serves multiple user queries from one bot crawl (1 impression per crawl, not per query — expected behaviour)

**Still demo/placeholder:**
- The test page (Finance Weekly ISA article) is hardcoded in api/index.js. Not a real publisher page.
- api/sdk.js is a client-side placeholder. No real server-side publisher middleware exists yet.
- One creative at a time. No auction. No multiple campaigns. No budget tracking.
- No contextual matching. The platform cannot yet figure out what a page is about and serve the right creative.

---

## Environment Variables Required

```
KV_REST_API_URL         Upstash Redis REST URL (set by Vercel-Upstash integration)
KV_REST_API_TOKEN       Upstash Redis token (set by Vercel-Upstash integration)
PLATFORM_URL            Optional. Used in injector.js for click tracking URLs.
                        Defaults to https://testbot-two-psi.vercel.app
VERCEL_REGION           Auto-set by Vercel. Used in /health response only.
```

---

## Active Constraints

1. **Vercel Hobby: 12 serverless function limit.** Currently 7 used. 5 free. Never add a file without checking.
2. **No GTM/client-side injection for real crawlers.** Real AI bots don't execute JS. Server-side only.
3. **Googlebot/GoogleOther must never receive injected content.** cloakingRisk flag enforces this.
4. **requestsPerMinute is always passed as 1** in index.js. The behavioural rate signal (+30 pts) never fires. Known limitation. Fix requires per-IP KV rate tracking with 60s TTL. Not worth the complexity yet.
5. **One creative at a time.** The campaign schema doesn't have IDs, budgets, or keyword lists yet. Everything routes to `creative:finance_investing`.
6. **Upstash free tier: 500k commands/month.** More than enough for current scale. Monitor if impression volume grows significantly.
