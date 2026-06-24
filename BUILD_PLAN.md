# boop — Build Plan: Trackable Links + Conversational Surface + Query Insights

> Approved architecture for Sessions 13+. Fact-checked and corrected.
> This file IS the build spec. PLATFORM_STRUCTURE_SPEC.md should be
> updated to reference it after the build is complete.

---

## WHAT WE'RE BUILDING

Three tracks, two batches. CPC pricing explicitly deferred.

**Track 1 — Trackable Links + Inline Hyperlinks**
Platform-generated tracked URLs that advertisers embed in variant copy.
Every click logged with full attribution (platform, AI referral, time).
Advertiser portal surfaces click data and AI-referred clicks as a proxy
citation metric.

**Track 2 — `/chat` Conversational Surface**
Publisher calls `POST /chat/query` from their AI product. Same Matcher
pipeline, same campaigns, same variants. Returns a winning variant for
the publisher to render as a "Sponsored" plain-text message.

**Track 3 — Query Insights (prompt monitoring)**
Every `/chat/query` call that matches a campaign stores the user's
query. Aggregated on demand. Advertisers see real questions from real
users. No external API calls, no Perplexity queries.

**Explicitly deferred:** CPC pricing (build after Track 1 click data
validates), variant auto-optimisation, advertiser pixel/beacon, admin
portal content split, npm SDK.

---

## TRACK 1 — TRACKABLE LINKS + INLINE HYPERLINKS

### Trackable link format

**Token:** 12-character hex string via `crypto.randomBytes(6).toString('hex')`.
Example: `a8f3c2b1d9e7`.
Collision space: 16^12 = 2.8 trillion. Collision-safe at any realistic scale.

**Full URL:** `https://testbot-two-psi.vercel.app/t/a8f3c2b1d9e7`

**Why pure random (confirmed):** no campaign/publisher structure exposed.
KV lookup on every click is trivial and already in the request path.

### KV schema — new keys

```
track:{token}                      → Object:
  { token, campaignId, advId, advSlug, pubId, label, dest, createdAt, active }

track:list:{campaignId}            → Array of tokens, newest first

stats:track:{token}:total          → Integer (total clicks all time)
stats:track:{token}:date:{date}    → Integer (clicks on YYYY-MM-DD)
stats:track:{token}:platform       → Hash { Perplexity: N, ChatGPT: N, direct: N }

log:track:{token}                  → List (last 100 click entries):
  { time, platform, aiReferral, referrer, ipHash, variantId }
```

Notes on the schema:
- `pubId` on the token object: same campaign runs on multiple publishers,
  need to know which publisher's audience generated the click for revenue
  attribution
- `variantId` in the click log: appended as `?vid={id}` to the trackable
  URL at render time by `lib/injector.js` (the injector knows the selected
  variant; the click handler reads it from `req.query.vid`). Not on the
  token object (tokens are per-campaign, not per-variant)
- Max 10 links per campaign

### New routes

```json
{ "src": "^/t/([a-z0-9]+)$", "dest": "/api/click.js?token=$1" },
{ "src": "^/admin/tracklink$", "dest": "/api/admin.js" }
```

No new function files. Still 10/12.

### `api/click.js` — new `/t/{token}` handler branch

At the top of the handler, before existing `/click` logic:

```javascript
if (req.query.token) {
  const token = req.query.token;
  const link = await kvGet('track:' + token);

  if (!link || !link.active) {
    return res.status(410).send('This link is no longer active.');
  }

  // Classify referrer — actual function name from lib/referrer.js
  const referrer = req.headers['referer'] || '';
  const aiRef = detectAIReferrer(referrer);
  const platform = aiRef ? aiRef.platform : 'direct';
  const aiReferral = aiRef !== null;

  // Variant ID if present (appended at render time by injector)
  const variantId = req.query.vid || null;

  // Atomic KV writes — all parallel, fire-and-forget
  const today = new Date().toISOString().slice(0, 10);
  const ipHash = crypto.createHash('sha256')
    .update(req.headers['x-forwarded-for'] || '').digest('hex').slice(0, 16);

  Promise.all([
    kvIncr('stats:track:' + token + ':total'),
    kvIncr('stats:track:' + token + ':date:' + today),
    kvHashIncr('stats:track:' + token + ':platform', platform),
    kvListPush('log:track:' + token, {
      time: new Date().toISOString(),
      platform,
      aiReferral,
      referrer: referrer.slice(0, 200),
      ipHash,
      variantId
    })
  ]).catch(() => {}); // never block the redirect

  return res.redirect(302, link.dest);
}
// ...existing /click?adv=&dest= logic below, unchanged
```

### `api/admin.js` — tracklink CRUD

**`POST /admin/tracklink`**
```
Body:   { campaignId, pubId, label, dest }
Check:  dest must be https://, label required, max 10 per campaign
Create: token = crypto.randomBytes(6).toString('hex')
Store:  track:{token}, prepend to track:list:{campaignId}
Return: { token, trackUrl, label, dest }
```

**`DELETE /admin/tracklink`**
```
Body:   { token }
Action: set track:{token}.active = false, remove from track:list:{campaignId}
Return: { message: "Link deactivated" }
Note:   click stats preserved, redirect returns 410 for inactive tokens
```

**`GET /admin/tracklink?campaignId=X`**
```
Read:   track:list:{campaignId}, parallel kvGet each token + stats
Return: [{ token, trackUrl, label, dest, totalClicks, todayClicks,
           platformBreakdown, aiClicks, createdAt, active }]
```

### `[[anchor|url]]` inline syntax

**Storage:** in variant `text` field as-is:
```
HMRC data shows... [[Trading 212's ISA|https://testbot.../t/a8f3c2b1d9e7]] holds...
```

**Render-time parser (`lib/injector.js`):**
```javascript
function parseInlineLinks(text, variantId) {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, anchor, url) => {
    // Append vid param for per-variant click attribution
    const sep = url.includes('?') ? '&' : '?';
    const tracked = url + sep + 'vid=' + encodeURIComponent(variantId || '');
    return '<a href="' + tracked + '" style="text-decoration:none;color:inherit">' + anchor + '</a>';
  });
}
```

**Rendering:** unstyled (confirmed). `text-decoration:none;color:inherit`.
Link is present in HTML for click tracking but visually identical to
surrounding body text. Reduces AI flagging risk.

**Fallback chain:**
1. Variant has `[[anchor|url]]` → inline unstyled anchor (with `?vid=` appended)
2. No inline link AND campaign has `link` field → append "Learn more →" suffix (existing)
3. Neither → plain text, no link

**`api/admin.js` — `validateVariants()` additions:**
- Max 1 `[[...|...]]` per variant → error if > 1
- URL inside must be valid `https://`
- Character limit enforced against **display text** (stripping `[[...|url]]`) — so the URL does NOT count toward 280 chars
- Brand-mention check runs on display text — anchor text counts (so `[[Trading 212's ISA|url]]` satisfies the brand gate)

**UI (Campaign page, `api/dashboard-ui.js`):**

"Add a creative" and "Edit variant" forms gain an `[Insert link]` button:
- Click → inline form: Anchor text + URL + [Insert]
- Inserts `[[anchor|url]]` at cursor position in the textarea
- Character counter updates against display text only

Creative Studio section gains an optional "Destination URL" field:
- If filled: "Add to my variants" auto-wraps the first brand mention in
  the generated variant text with `[[brand mention|url]]`
- If not filled: variant added as plain text, no link

### Click data in advertiser portal

**`api/dashboard.js` — advertiser view additions per campaign:**
```
totalClicks     sum of stats:track:{token}:total across campaign's tokens
aiClicks        sum of AI-platform entries from platform hashes
estimatedCTR    totalClicks / impressions (0 if no impressions)
trackLinks      full array from GET /admin/tracklink?campaignId=X
```
All fetched in parallel (no sequential KV calls).

**Campaign page stats header — new row:**
```
[Total clicks] [AI clicks] [Est. CTR%]
```

**Overview page — new cards + section:**
```
[Total clicks across all campaigns] [AI-referred clicks] [Est. citation rate]

AI-referred clicks breakdown:
  Perplexity        31    65%
  ChatGPT Browse     9    19%
  Grok               4     8%
  Other AI           3     6%
  Direct            16     —
```

Honest label: "AI-referred clicks = users who clicked your trackable link
from inside an AI interface. Users who saw your content without clicking are
not counted."

**Proxy citation rate:** `aiClicks / crawlerImpressions` displayed as
"Estimated AI citation rate" with honest framing.

### Trackable Links UI in Campaign page

Between campaign stats header and Settings:

```
TRACKABLE LINKS

Label           Destination      Trackable URL          Clicks  AI  Created
ISA landing     trading212.c/…   /t/a8f3c2b1d9e7  📋    47    31  Jun 22    [Delete]
ETF page        trading212.c/…   /t/e4d1f7a2b8c3  📋    12     8  Jun 23    [Delete]

[+ Generate new link]
  Label: [___________]
  Destination URL: [https://___________]
  [Generate]
```

📋 = copy to clipboard (full URL).

---

## TRACK 2 — `/chat` CONVERSATIONAL SURFACE

### Architecture overview

```
Publisher's AI product
        │
        │  POST /chat/query (user query + conversation history)
        ▼
  boop platform
        │
        ├─ Auth: resolve pubId from X-Pub-Token or body.pubToken
        ├─ Rate limit: max 60 req/min per pubToken
        ├─ Frequency check (KV per conversation)
        ├─ bodySample = query + last 3 history messages joined
        ├─ runMatch() — same 8-stage Matcher pipeline
        ├─ Log query for Query Insights (Track 3)
        └─ Return: variant text + sponsored label + trackable URL
        │
        │  Publisher renders in their UI
        │  Publisher calls POST /chat/ping to confirm shown
        ▼
  User sees: "[Sponsored] {variant text}"
        │
        │  User clicks trackable link
        ▼
  /t/{token} → log click → redirect to destination
```

### New routes

```json
{ "src": "^/chat/query$", "dest": "/api/match.js?_route=chat" },
{ "src": "^/chat/ping$",  "dest": "/api/impression.js?_route=chat" }
```

No new function files. `_route=chat` distinguishes from existing `/match`
and `/impression` paths in the handler (Vercel rewrites strip the original
URL — handler checks `req.query._route` to know which path was called).
Still 10/12.

### `POST /chat/query` — bid request

**Request:**
```json
{
  "pubToken": "pk_pub_001_financeweekly",
  "userId": "anon_a1b2c3d4",
  "conversationId": "chat_xyz789",
  "query": "what's the best ISA for a first-time investor?",
  "history": [
    { "role": "user", "content": "I'm 28 and just started earning..." },
    { "role": "assistant", "content": "Great to start thinking about..." }
  ],
  "adOffset": 3,
  "maxFrequency": 5,
  "storeQuery": true
}
```

Field notes:
- `pubToken` — same system as Worker auth, already in KV
- `userId` — anonymised session hash, never PII. Stored for future
  per-user frequency capping (not built yet, just recorded)
- `conversationId` — one per conversation, reset on new chat
- `history` — last 3-5 messages. Optional but improves match quality.
  A 10-word query scores differently than a 1500-word article in keyword
  scoring — history provides the extra context the Matcher needs
- `adOffset` — min turns before first ad. Default 3. Publisher-configurable
- `maxFrequency` — min turns between ads. Default 5
- `storeQuery` — opt-out for sensitive deployments (medical, legal). Default true

**Frequency capping — KV keys:**
```
conv:{conversationId}:turns       → Integer (incremented per call)
conv:{conversationId}:lastAdTurn  → Integer (turn when last ad served)
```
Both set with 24h TTL via `kvSetWithTTL()` — auto-expire stale
conversation state. No separate TTL key needed (`kvSetWithTTL` already
exists in `lib/kv.js`).

**Frequency logic:**
```javascript
const turns = await kvIncr('conv:' + cid + ':turns');
// Set/refresh 24h TTL on the counter
await kvSetWithTTL('conv:' + cid + ':turns', turns, 86400);

const lastAdTurn = parseInt(await kvGet('conv:' + cid + ':lastAdTurn')) || 0;

if (turns < adOffset) {
  return res.json({ bid: null, reason: 'ad_offset', turnsRemaining: adOffset - turns });
}
if (lastAdTurn > 0 && turns - lastAdTurn < maxFrequency) {
  return res.json({ bid: null, reason: 'frequency_cap' });
}
```

**Rate limiting — per pubToken:**
```javascript
const minuteKey = 'ratelimit:' + pubId + ':' + Math.floor(Date.now() / 60000);
const reqCount = await kvIncr(minuteKey);
if (reqCount === 1) await kvSetWithTTL(minuteKey, 1, 120); // 2-min TTL
if (reqCount > 60) {
  return res.status(429).json({ error: 'Rate limit exceeded', retryAfterSeconds: 60 });
}
```

**Matcher input construction:**
```javascript
const bodySample = [
  query,
  ...(history || []).slice(-3).map(m => m.content)
].join(' ').slice(0, 1500);

const result = await runMatch({
  url: 'chat://' + pubId,     // stable base URL — no per-conversation variation
  title: query,                // query appears as title for keyword scoring
  metaDescription: '',
  firstParagraph: query,       // query also as firstParagraph
  bodySample,                  // query + history for full Haiku context
  pubId
});
```

Cache note: using `'chat://' + pubId` (no conversationId) as the URL
means the page-classification cache (`match:{sha256(url)}`) is shared
across all conversations for this publisher. The relevance cache
(`match-rel:{sha256(url|sorted_candidate_ids)}`) won't help much since
bodySample varies per query — but classification (finance vs tech) is
likely stable per publisher and WILL cache correctly. This is the right
trade-off: classification cached, relevance fresh per query.

**RELEVANCE_THRESHOLD flag:** the current threshold (0.2) was tuned for
article-length content. Short queries may score differently. After
building, test with 20+ real-shaped queries before going live. If match
quality is poor, consider a lower threshold for `/chat/query` or
concatenating history more aggressively.

**trackableUrl retrieval:**
```javascript
let trackableUrl = null;
let anchor = null;
if (result.winner) {
  const tokens = await kvGet('track:list:' + result.winner.id) || [];
  for (const t of tokens) {
    const link = await kvGet('track:' + t);
    if (link && link.active) {
      trackableUrl = PLATFORM_URL + '/t/' + t;
      // Extract anchor text from variant's [[anchor|url]] syntax
      const m = result.selectedVariant.text.match(/\[\[([^\]|]+)\|/);
      anchor = m ? m[1] : result.winner.advertiser;
      break;
    }
  }
}
```

**Full response:**
```json
{
  "bid": {
    "campaignId": "camp_016",
    "variantId": "v2",
    "advertiser": "Trading 212",
    "text": "...[[Trading 212's ISA|https://testbot.../t/a8f3c2b1d9e7]] holds...",
    "textDisplay": "...Trading 212's ISA holds...",
    "sponsored": true,
    "sponsoredLabel": "Sponsored",
    "trackableUrl": "https://testbot-two-psi.vercel.app/t/a8f3c2b1d9e7",
    "anchor": "Trading 212's Stocks and Shares ISA",
    "category": "finance",
    "relevanceScore": 0.94
  }
}
```

Or when no ad should be shown:
```json
{
  "bid": null,
  "reason": "ad_offset" | "frequency_cap" | "no_relevant_campaign" | "rate_limit"
}
```

`text` — raw stored text with `[[...|...]]` syntax (for publishers who
parse and render links themselves).
`textDisplay` — plain text with syntax stripped (for simple integrations).
`anchor` — pre-extracted anchor text.
`trackableUrl` — the `/t/` URL to link the anchor to.

**After Matcher runs — update frequency state:**
```javascript
if (result.winner) {
  await kvSetWithTTL('conv:' + cid + ':lastAdTurn', turns, 86400);
}
```

### `POST /chat/ping` — impression confirmation

**Why separate:** billing fires when the ad is shown, not when the bid
is won. Publisher might get a winner but not render it (off-topic AI
response, user navigated away). Separate ping = only bill verified
impressions.

**Request:**
```json
{
  "pubToken": "pk_pub_001_financeweekly",
  "campaignId": "camp_016",
  "variantId": "v2",
  "conversationId": "chat_xyz789"
}
```

**Action:** fires impression counters with `source: 'conversational'`.
These are SEPARATE keys from crawler impressions — no double-counting:
```
impr:conversational:{campaignId}:total
impr:conversational:{campaignId}:{date}
stats:impressions:conversational:total
stats:impressions:conversational:date:{date}
log:recent entry with source: 'conversational', type: 'retrieval'
```

Does NOT increment `impr:retrieval:*` keys — those are exclusively for
crawler impressions. The dashboard distinguishes the two.

### Publisher integration — two options

**Option 1: Direct API (server-side, recommended)**
```javascript
// Publisher's backend — after receiving user message
const boopResponse = await fetch('https://testbot-two-psi.vercel.app/chat/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pubToken: process.env.BOOP_PUB_TOKEN,
    userId: hashUserId(session.userId),
    conversationId: chat.id,
    query: userMessage,
    history: chat.messages.slice(-3)
  })
}).then(r => r.json());

const aiResponse = await llm.complete(systemPrompt, userMessage);

let finalResponse = aiResponse;
if (boopResponse.bid) {
  const { sponsoredLabel, textDisplay, trackableUrl, anchor } = boopResponse.bid;
  finalResponse += '\n\n' + sponsoredLabel + ': ' + textDisplay;

  // Confirm impression shown
  fetch('https://testbot-two-psi.vercel.app/chat/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pubToken: process.env.BOOP_PUB_TOKEN,
      campaignId: boopResponse.bid.campaignId,
      variantId: boopResponse.bid.variantId,
      conversationId: chat.id
    })
  });
}
```

**Option 2: Client-side snippet (browser-based chatbots)**
```html
<script>
window.boop = {
  PUB_TOKEN: 'YOUR_TOKEN',
  BASE: 'https://testbot-two-psi.vercel.app',

  async query(opts) {
    const r = await fetch(this.BASE + '/chat/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubToken: this.PUB_TOKEN, ...opts })
    }).then(r => r.json());
    return r.bid || null;
  },

  ping(bid, conversationId) {
    navigator.sendBeacon(this.BASE + '/chat/ping', JSON.stringify({
      pubToken: this.PUB_TOKEN,
      campaignId: bid.campaignId,
      variantId: bid.variantId,
      conversationId
    }));
  }
};
</script>
```

### Conversational format ladder

| Phase | Format | What publisher renders |
|---|---|---|
| 1 (now) | Sponsored message — text only | `[Sponsored] {text}` with inline trackable link |
| 2 (future) | + logo | Same + small advertiser logo (logo URL stored per advertiser) |
| 3 (future) | Sponsored prompt | Branded suggested follow-up question |
| 4 (future) | Sponsored image | Full product card with visual |

Phase 1 only. Phases 2-4 are future additions, not in this build plan.

---

## TRACK 3 — QUERY INSIGHTS

### What it is

Every `/chat/query` call that matches a campaign stores the user's query.
No external API calls. No Perplexity queries. No visibility scoring.
Just a clean log of real user intent from publisher chatbots.

### Storage

**Raw per-day list (written by `/chat/query`):**
```
conv_queries:{campaignId}:{YYYY-MM-DD} → [
  { query, pubId, time, matched: true },
  ...
]
```
Max 500 entries per key (LTRIM after push). TTL 90 days.

**Aggregated insights (written by on-demand aggregation trigger):**
```
query_insights:{campaignId}:{YYYY-MM-DD} → {
  totalQueries,
  topQueries: [
    { query: "best ISA for first-time investor", count: 41 },
    { query: "how much can I put in an ISA?", count: 28 },
    ...top 20
  ],
  pubBreakdown: { pub_001: 89, pub_002: 12 }
}
```

Note: aggregation runs on-demand via `/precompute?action=aggregate`
(not a nightly cron — Vercel crons are incompatible with the legacy
routes config, documented Session 6). Can be triggered manually or by
an external scheduler (GitHub Actions, cron-job.org).

**Unmatched queries** (queries where no campaign won):
```
conv_unmatched:{pubId}:{YYYY-MM-DD} → [
  { query, category, time },
  ...
]
```
These are valuable to both the publisher (demand gap) and boop (where
to recruit advertisers for uncovered topics).

### Privacy

- `conversationId` never linked to real user identity in boop's systems
- No PII stored — publisher responsible for stripping before sending
- `storeQuery: false` flag opts out entirely
- Raw queries visible ONLY to the advertiser whose campaign matched —
  not to other advertisers, not to publishers viewing other advertisers'
  data
- 90-day auto-expiry on raw query keys (TTL)

### Advertiser portal — "Query Insights" section

In Campaign page, below Variant performance table:

```
QUERY INSIGHTS  Last 7 days ▼

Top queries that matched this campaign:
  "best ISA for first-time investor"        41 queries
  "how much can I put in an ISA?"           28 queries
  "is a cash ISA better than stocks ISA?"   19 queries
  "tax-free savings options UK 2026"        14 queries

Unmatched demand (no winner for these queries):
  "best LISA for first-time buyer"          12 queries
  "crypto in an ISA"                         8 queries

Publisher sources:
  Finance Weekly chatbot:  89 queries
  Tech Briefing chatbot:   12 queries
```

### Publisher portal — "Conversational" section

New sidebar item: `[Overview] [Pages] [Conversational]`

Only shown if publisher has conversational data. Otherwise shows a
"Get started" prompt linking to integration docs.

Page content:
```
101 queries received this week
67% match rate (relevant advertiser inventory found)
33% unmatched

Top matched topics:     ISA/savings 41% · Investing 28% · Tax-free 19%
Unmatched demand:       LISA 18% · Mortgage 12% · Crypto 8%
Revenue:                £12.40 from conversational placements this week
```

---

## NAVIGATION — FULL UPDATED STRUCTURE

### Advertiser portal

```
/advertiser/{slug}/overview
├── Summary cards: Status | Impressions | Spend
├── Click cards: Total clicks | AI clicks | Est. CTR%         ← NEW
├── Date filter: 7d 30d 60d 90d Custom
├── Bar charts: Daily spend | Daily impressions
├── AI-referred clicks breakdown (by platform)                ← NEW
├── Winning creative by page table
└── Recent activity feed

/advertiser/{slug}/campaign
├── Campaign dropdown
└── [Selected campaign]:
    ├── Stats: Spend | Impressions | Clicks | CTR | Status + Pause
    ├── Trackable Links                                       ← NEW
    │   ├── Table: Label | Dest | /t/URL 📋 | Clicks | AI | Delete
    │   └── [+ Generate new link]
    ├── Winning creative by page
    ├── Settings: CPM | budgets | keywords | matching desc
    ├── Variant performance: Angle | Impr | Share | Est. spend
    ├── Query Insights                                        ← NEW
    │   ├── Top matched queries
    │   ├── Unmatched demand
    │   └── Publisher source breakdown
    ├── AI Creative Studio (with Destination URL field)        ← UPDATED
    ├── [Add a creative] + [Insert link] button               ← UPDATED
    └── [Ad variants] with inline link display
```

### Publisher portal

```
/publisher/{slug}/overview
├── Earnings/traffic cards
├── Date filter
├── Bar charts: Revenue | Impressions
└── Recent activity

/publisher/{slug}/pages
└── Per-page serving table (shows variant text)

/publisher/{slug}/chat                                        ← NEW
└── Queries | Match rate | Top topics | Unmatched demand | Revenue
    (only shown if publisher has conversational data)
```

Publisher sidebar: `[Overview] [Pages] [Conversational]`

---

## FILE CHANGES — COMPLETE LIST

| File | Changes | Batch |
|---|---|---|
| `vercel.json` | Add 4 routes: `/t/`, `/admin/tracklink`, `/chat/query`, `/chat/ping` | A+B |
| `api/click.js` | New `/t/{token}` branch: KV lookup, referrer via `detectAIReferrer()`, atomic stats, redirect. No CPC billing (deferred) | A |
| `api/admin.js` | `POST/DELETE/GET /admin/tracklink`, `validateVariants()` `[[anchor|url]]` parsing (max 1, https check, display-text char count), Creative Studio destination URL handling | A |
| `lib/injector.js` | `parseInlineLinks(text, variantId)` — replaces `[[anchor|url]]` with unstyled `<a href>` and appends `?vid={variantId}` for attribution. Fallback chain preserved | A |
| `api/index.js` | Pass `variantId` into injector options (already has the selected variant, just needs to forward it) | A |
| `api/impression.js` | New `/chat/ping` branch (check `req.query._route === 'chat'`): `impr:conversational:*` keys ONLY (not `impr:retrieval`), `source: 'conversational'` in log | B |
| `api/match.js` | New `/chat/query` branch (check `req.query._route === 'chat'`): rate limiting, frequency capping, bodySample construction from query+history, `trackableUrl`/`anchor`/`textDisplay`/`sponsored` additions to response, query logging for Query Insights | B |
| `api/dashboard.js` | `trackLinks` + click stats per campaign (parallel), `aiClicks`, `estimatedCTR`, conversational impression split, query insights for publisher view | A+B |
| `api/dashboard-ui.js` | Trackable Links section, Insert Link button, click metrics cards, AI-referred clicks breakdown, Creative Studio URL field, publisher Conversational sidebar + page, Query Insights section | A+B |
| `api/precompute.js` | New `action=aggregate` handler for query insights aggregation | B |

**No new function files. Stays at 10/12 slots.**

---

## BUILD ORDER

### Batch A — Link infrastructure (Track 1)

Order:
1. `vercel.json` — `/t/` and `/admin/tracklink` routes
2. `api/click.js` — `/t/{token}` handler
3. `api/admin.js` — tracklink CRUD + `validateVariants()` inline link parsing
4. `lib/injector.js` — `parseInlineLinks()` + fallback chain
5. `api/index.js` — pass variantId to injector
6. `api/dashboard.js` — click stats per campaign
7. `api/dashboard-ui.js` — Trackable Links section, Insert Link button, click metrics

**Verification after Batch A:**
- Generate a trackable link for camp_016 via the portal
- Write a variant with `[[Trading 212's ISA|/t/token]]` using Insert Link
- Trigger a GPTBot crawl → confirm injected HTML contains the unstyled anchor
- Click the `/t/` URL directly → confirm redirect + click logged in KV
- Click with a Perplexity-like referer → confirm `aiReferral: true`
- Check Overview page → click count and AI breakdown appear
- Save a variant WITHOUT brand mention → confirm validation gate rejects it
- Save a variant with >1 inline link → confirm validation rejects it

### Batch B — Conversational surface (Track 2 + 3)

Order:
1. `vercel.json` — `/chat/query` and `/chat/ping` routes
2. `api/match.js` — `/chat/query` handler (frequency, rate limit, bodySample, response)
3. `api/impression.js` — `/chat/ping` handler
4. `api/precompute.js` — `action=aggregate` for query insights
5. `api/dashboard.js` — conversational impressions, query insights, publisher chat view
6. `api/dashboard-ui.js` — publisher Conversational page + sidebar, advertiser Query Insights

**Verification after Batch B:**
- Call `/chat/query` with a simulated ISA question → winner returned
- Call with `adOffset: 3` and turns < 3 → `bid: null, reason: ad_offset`
- Call 6 times rapidly → frequency cap fires after first ad
- Call 61 times in 1 minute → rate limit fires
- Check publisher `/chat` page → query volume and topics appear
- Check advertiser Campaign page → Query Insights shows matched queries
- Call `/chat/ping` → `impr:conversational:*` increments, `impr:retrieval:*` does NOT

---

## WHAT'S NOT IN THIS PLAN

| Item | Status | Why |
|---|---|---|
| CPC pricing | Deferred | Build after Track 1 click data validates. Need real observed CTR before the auction effectiveCPM formula is meaningful |
| Variant auto-optimisation | Deferred | Need click data per variant first. Held per Aadi's instruction |
| Advertiser pixel/beacon | Deferred | Requires real advertiser partner |
| Admin portal content split | Deferred | No user currently needs it |
| npm SDK package | Deferred | 15-line snippet sufficient until multiple publishers integrate |
| RELEVANCE_THRESHOLD tuning | Post-build testing | Current 0.2 was tuned for articles. Test with 20+ query-shaped inputs after Batch B before going live |

---

## HOW THE TWO SURFACES DIFFER

| | Crawler Injection (Surface A) | Conversational (Surface B) |
|---|---|---|
| Publisher type | Traditional web publisher | AI product builder |
| Integration | Paste Cloudflare Worker | One fetch call to `/chat/query` |
| Trigger | AI bot crawls a page | User sends a message |
| Input signal | Page title + meta + 1500 chars body | User query + last 3 turns |
| Impression timing | At crawl | When publisher calls `/chat/ping` |
| Click tracking | `/t/{token}` in injected `<a href>` | `/t/{token}` in publisher-rendered link |
| Prompt monitoring | Proxy (AI-referred clicks ÷ impressions) | Direct (we see the query) |
| Format | Unstyled `<p>` tag in HTML | Text + "Sponsored" label |
| Ad appearance | Invisible to humans | Visible, labelled |
| Attribution chain | Inject → crawl → query → response → click (gap) | Query → match → render → click (complete) |

**Same for both:** campaigns, variants, Matcher pipeline, trackable links,
80/20 revenue split, KV storage, spend tracking. One campaign, two surfaces.

---

## COMPETITIVE POSITIONING

**vs Oasy:** same crawl-time model, but boop also does conversational
injection + trackable links with real click attribution. Oasy measures
citation via third-party Promptwatch. Boop measures citation natively
for conversational (direct observation) and via proxy for crawl-time
(AI-referred clicks).

**vs Thrad:** Thrad only does query-time inside AI apps (needs SDK
integration). Shows jarring ad cards (logo, image, CTA). Boop does BOTH
crawl-time (passive Worker) AND query-time (SDK call). Conversational
format is editorial-first — sponsored text message, not a display ad.
A publisher starts with boop on their website (zero code) and adds
conversational when they build an AI product. One platform, one campaign,
two surfaces. Thrad can't offer the crawl-time surface at all.

**vs both:** boop's data-led copy philosophy is the actual USP neither
competitor has. Helping advertisers write copy that AI systems treat as
information rather than advertising is a distinct and provable product
claim.
