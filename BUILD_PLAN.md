# boop — BUILD PLAN: Sessions 13+
# Trackable Links + Conversational Surface + Query Insights

> This is the authoritative build spec for Sessions 13+.
> Written at the end of Session 12 after full architecture review,
> competitive analysis (Thrad.ai, Oasy.ai), and fact-checking (14 issues
> corrected from the first draft). The next Claude session should read
> this file, CLAUDE.md, HANDOVER.md, and CONTINUE.md before touching
> any code. PLATFORM_STRUCTURE_SPEC.md Parts 21-25 have the full
> competitive and architectural context.
>
> CRITICAL: The two surfaces (crawler injection and conversational
> injection) must never contaminate each other. Read the separation
> rules in Section 7 before touching api/match.js or api/impression.js.

---

## SECTION 1: OVERVIEW — WHAT WE'RE BUILDING AND WHY

### The commercial gap today

boop today has two limitations that block real advertiser value:

**Gap 1 — No click attribution.** Advertisers see impressions (crawl
events logged) but cannot see whether anyone clicked through to their
site from an AI-cited page. The /click endpoint exists and logs data,
but none of it surfaces in the portal. There is no link in the injected
paragraph for anyone to click anyway.

**Gap 2 — Only one surface.** boop only monetises AI crawler traffic to
traditional web pages. Publishers building AI chatbots and assistants on
top of their content have no boop integration path. This is the fastest-
growing publisher category and where Thrad.ai currently operates.

### What we're building — three tracks

**Track 1 — Trackable Links + Inline Hyperlinks (Batch A)**
Platform-generated tracked URLs (/t/{token}) that advertisers embed in
their variant copy using [[anchor|url]] inline syntax. Every click logged
with full attribution. Advertiser portal surfaces click data and AI-
referred clicks as a proxy citation metric.

**Track 2 — /chat Conversational Surface (Batch B)**
Publisher calls POST /chat/query from their AI product (chatbot, AI
assistant). Same Matcher pipeline, same campaigns, same variants. Returns
a winning variant for the publisher to render as a "Sponsored" message.
Includes: history-based relevance gate, conversational bridge phrase,
frequency capping, rate limiting.

**Track 3 — Query Insights (Batch B)**
Every /chat/query call that matches a campaign stores the user's query.
Aggregated on demand. Advertisers see real questions from real users.
Publishers see demand gaps. No external API calls — just storing what
we already observe.

### What is explicitly deferred

- CPC pricing (build after Track 1 click data validates)
- Variant performance auto-optimisation (held per Aadi's instruction)
- Advertiser pixel/beacon (needs real advertiser partner)
- Admin portal content split
- npm SDK package (15-line snippet sufficient for now)

---

## SECTION 2: THE TWO-SURFACE SEPARATION RULE

> Read this before touching api/match.js or api/impression.js.
> This is the most important architectural constraint in the build.

boop has two injection surfaces that must never contaminate each other:

**Surface A — Crawler Injection (live, working today)**
Cloudflare Worker detects AI bot → calls /match → injects variant into
HTML → logs impression via /impression. Fires at crawl time.

**Surface B — Conversational Injection (new, to be built)**
Publisher's chatbot calls /chat/query → Matcher runs on user query →
returns variant JSON → publisher renders "Sponsored" message → publisher
confirms with /chat/ping. Fires at query time.

### How they are kept separate

**Route separation:**
```
/match        → api/match.js                (Surface A, unchanged)
/impression   → api/impression.js           (Surface A, unchanged)
/chat/query   → api/match.js?_route=chat    (Surface B, new branch)
/chat/ping    → api/impression.js?_route=chat (Surface B, new branch)
```

The handler checks req.query._route at the very top. If _route=chat,
it goes to the new conversational branch. If not, it goes to the
existing crawler path unchanged. The two code paths never touch each
other's logic.

**KV key separation — CRITICAL, no exceptions:**

Surface A writes to:
```
impr:retrieval:{campaignId}:total
impr:retrieval:{campaignId}:{date}
stats:impressions:total
stats:impressions:date:{date}
```

Surface B writes to:
```
impr:conversational:{campaignId}:total
impr:conversational:{campaignId}:{date}
stats:impressions:conversational:total
stats:impressions:conversational:date:{date}
```

Surface B NEVER writes to impr:retrieval:* keys. Not ever. This is the
double-counting guard. One bad write ruins spend tracking and billing.

**The one shared data structure — log:recent:**
Both surfaces push to log:recent. This is intentional — the dashboard
needs a unified timeline. The contamination risk is that the Live
Auction Board (which is page-specific) would show chatbot query results
as if they were page URLs.

Guard: every log:recent entry from Surface B includes source:
'conversational'. Every dashboard query that builds the page-specific
Live Auction Board filters WHERE source !== 'conversational'. The
advertiser portal Recent Matches shows both, labelled. The publisher
portal Conversational page shows only source: 'conversational'.

**What IS shared (intentionally):**

| Shared resource | Why intentional |
|---|---|
| Campaign data in KV | Both surfaces compete from the same pool — this is the whole point |
| runMatch() Matcher | Same algorithm, different text input — no interference |
| Spend tracking (spend:daily, spend:total) | One campaign, one budget, across both surfaces — correct |
| Variant bank | Same variants, Haiku selects the most appropriate per context |
| Trackable links (/t/{token}) | Same links work whether clicked from a crawled page or a chatbot |

**What the publisher's LLM never sees:**
boop's Haiku calls (all three of them) run entirely inside /chat/query.
The publisher's code calls boop's API and their own LLM in parallel.
boop's response is a JSON object — the publisher decides where to render
it. boop never touches the publisher's LLM prompt, system message, or
conversation history. The publisher's LLM never receives boop's variant
text as input. They share nothing except the user's message, which both
receive simultaneously as read-only input.

The publisher's integration code looks like this:

```javascript
// These fire in PARALLEL — neither influences the other
const [aiResponse, boopBid] = await Promise.all([
  openai.chat.completions.create({   // publisher's LLM — unchanged
    messages: [...history, { role: 'user', content: userMessage }]
  }),
  fetch('https://testbot-two-psi.vercel.app/chat/query', {
    method: 'POST',
    body: JSON.stringify({ pubToken, query: userMessage, history: history.slice(-5) })
  }).then(r => r.json())
]);

// Publisher assembles both outputs in their UI
renderAIResponse(aiResponse.choices[0].message.content);
if (boopBid.bid) renderSponsoredMessage(boopBid.bid);
```

Integration rule to document explicitly: "Do not include boop's
sponsored message in the conversation history you send to your LLM.
It is display-only and must not influence future AI responses."

---

## SECTION 3: TRACK 1 — TRACKABLE LINKS + INLINE HYPERLINKS

### 3.1 Trackable link format

Token: 12-character hex string.
Generation: crypto.randomBytes(6).toString('hex')
Example token: a8f3c2b1d9e7
Full URL: https://testbot-two-psi.vercel.app/t/a8f3c2b1d9e7
Collision space: 16^12 = 2.8 trillion. Collision-safe at any scale.

Pure random — no campaign or publisher structure in the token. All
context resolved via KV lookup on every click. Reason: no internal
structure exposed to competitors or advertisers who might reverse-
engineer each other's campaign IDs.

### 3.2 KV schema — new keys

```
track:{token}                       → Object:
  { token, campaignId, advId, advSlug, pubId, label, dest, createdAt, active }

track:list:{campaignId}             → Array of tokens, newest first

stats:track:{token}:total           → Integer (total clicks all time)
stats:track:{token}:date:{date}     → Integer (clicks on YYYY-MM-DD)
stats:track:{token}:platform        → Hash { Perplexity: N, ChatGPT: N, direct: N }

log:track:{token}                   → List (last 100 click entries):
  { time, platform, aiReferral, referrer, ipHash, variantId }
```

Notes:
- pubId on the token: same campaign can run across multiple publishers.
  Need to know which publisher's audience generated each click for revenue
  attribution and for advertiser insight ("Finance Weekly clicks convert
  better than Tech Briefing clicks for ISA campaigns").
- variantId in the click log: the injector appends ?vid={variantId} to
  the trackable URL at render time. The click handler reads req.query.vid.
  The injector knows the selected variant; the token object does not need
  to store it (tokens are per-campaign, not per-variant).
- Max 10 links per campaign. Error if exceeded.
- IP stored as SHA-256 hash (first 16 chars only), never raw.
- Referrer truncated to 200 chars (enough for platform detection).

### 3.3 New routes in vercel.json

```json
{ "src": "^/t/([a-z0-9]+)$", "dest": "/api/click.js?token=$1" },
{ "src": "^/admin/tracklink$", "dest": "/api/admin.js" }
```

No new function files. Still 10/12.

### 3.4 api/click.js — new /t/{token} handler branch

Add at the very top of the handler, before any existing /click logic:

```javascript
if (req.query.token) {
  const token = req.query.token;
  const link = await kvGet('track:' + token);

  if (!link || !link.active) {
    return res.status(410).send('This link is no longer active.');
  }

  // Classify referrer — ACTUAL function name from lib/referrer.js
  // Returns { platform, referrerUrl, query } or null (not a string)
  const referrer = req.headers['referer'] || '';
  const aiRef = detectAIReferrer(referrer);
  const platform = aiRef ? aiRef.platform : 'direct';
  const aiReferral = aiRef !== null;

  // variantId appended by injector at render time as ?vid=
  const variantId = req.query.vid || null;

  const today = new Date().toISOString().slice(0, 10);
  const ipHash = require('crypto')
    .createHash('sha256')
    .update(req.headers['x-forwarded-for'] || '')
    .digest('hex')
    .slice(0, 16);

  // All parallel, fire-and-forget — never block the redirect
  Promise.all([
    kvIncr('stats:track:' + token + ':total'),
    kvIncr('stats:track:' + token + ':date:' + today),
    kvHashIncr('stats:track:' + token + ':platform', platform),
    kvListPush('log:track:' + token, {
      time: new Date().toISOString(),
      platform, aiReferral,
      referrer: referrer.slice(0, 200),
      ipHash, variantId
    })
  ]).catch(() => {});

  return res.redirect(302, link.dest);
}
// ...existing /click?adv=&dest= logic below, UNCHANGED
```

Note: detectAIReferrer is already imported at the top of click.js
(lib/referrer.js). Check this before adding a duplicate require.

### 3.5 api/admin.js — tracklink CRUD endpoints

Three new URL pattern checks in the existing handler:

POST /admin/tracklink — generate a new link
```
Body:   { campaignId, pubId, label, dest }
Checks: dest must start with https://, label required, max 10 per campaign
Token:  crypto.randomBytes(6).toString('hex')
Store:  kvSet('track:' + token, linkObject)
        prepend token to track:list:{campaignId} (kvGet → unshift → kvSet)
Return: { token, trackUrl: PLATFORM_URL + '/t/' + token, label, dest }
```

DELETE /admin/tracklink — soft delete
```
Body:   { token }
Action: kvGet track:{token}, set active: false, kvSet back
        remove token from track:list:{campaignId}
Return: { message: 'Link deactivated' }
Note:   click stats preserved. Redirect returns 410 for inactive tokens.
```

GET /admin/tracklink?campaignId=X — list with stats
```
Read:   track:list:{campaignId} → parallel kvGet each token
        parallel kvGet stats:track:{token}:total for each
Return: [{ token, trackUrl, label, dest, totalClicks, todayClicks,
           platformBreakdown, aiClicks, createdAt, active }]
```

### 3.6 [[anchor|url]] inline syntax in variant text

What it looks like stored in the variant text field:
```
HMRC data shows fewer than 30% of UK adults use their full £20,000 ISA
allowance. [[Trading 212's Stocks and Shares ISA|https://testbot-two-psi.vercel.app/t/a8f3c2b1d9e7]]
holds a globally diversified portfolio from £1, with no account fees.
```

lib/injector.js — parseInlineLinks() function added:
```javascript
function parseInlineLinks(text, variantId) {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, anchor, url) => {
    // Append vid param for per-variant click attribution
    const sep = url.includes('?') ? '&' : '?';
    const tracked = url + sep + 'vid=' + encodeURIComponent(variantId || '');
    return '<a href="' + tracked + '" style="text-decoration:none;color:inherit">'
      + anchor + '</a>';
  });
}
```

Rendering: unstyled (text-decoration:none;color:inherit). Link is present
in HTML for click tracking but visually identical to surrounding body
text. Reduces AI parser flagging risk — a styled hyperlink is one of the
strongest "this is an ad" signals to AI content parsers.

Fallback chain (backward compatible with existing campaigns):
1. Variant has [[anchor|url]] → inline unstyled anchor (with ?vid= appended)
2. No inline link AND campaign has link field → append "Learn more →" suffix
3. Neither → plain text, no link (same as today for all existing campaigns)

api/admin.js — validateVariants() additions:
- Max 1 [[...|...]] per variant → error if >1
- URL inside must be valid https:// → error if not
- Character limit enforced against DISPLAY TEXT only (strip [[...|url]]
  before counting) — the URL does not count toward 280 chars
- Brand-mention check runs on display text — anchor text counts as a
  brand mention if it contains the advertiser name

api/index.js — pass variantId into injector options:
```javascript
// Already has selectedVariant.id — just forward it
const injected = injectSponsoredContent(html, {
  text: selectedVariant.text,
  variantId: selectedVariant.id,  // ← ADD THIS
  link: selectedVariant.link || winner.link,
  // ...rest unchanged
});
```

### 3.7 Dashboard UI — new sections

Campaign page — new "Trackable Links" section (between stats header
and Settings):

```
TRACKABLE LINKS

Label              Destination       Trackable URL          Clicks  AI    Delete
ISA landing pg     trading212.com/…  /t/a8f3c2b1d9e7  📋    47     31    [Delete]
ETF page           trading212.com/…  /t/e4d1f7a2b8c3  📋    12      8    [Delete]

[+ Generate new link]
  Label: [___________]
  Destination URL: [https://___________]
  [Generate]
```

📋 copies full URL to clipboard. [Delete] calls DELETE /admin/tracklink.

"Add a creative" and "Edit variant" forms — new [Insert link] button:
- Click → inline form: Anchor text + URL → [Insert]
- Inserts [[anchor|url]] at cursor position in the textarea
- Character counter updates against display text (syntax stripped)

Creative Studio — optional Destination URL field:
- If filled: "Add to my variants" auto-wraps first brand mention with
  [[brand mention|url]]
- If not filled: variant added as plain text, no link

Campaign page stats header — new row:
```
[Total clicks] [AI clicks] [Est. CTR%]
```

Overview page — new cards:
```
[Total clicks] [AI-referred clicks] [Est. citation rate]
```

AI-referred clicks breakdown by platform:
```
Perplexity        31    65%
ChatGPT Browse     9    19%
Grok               4     8%
Other AI           3     6%
Direct            16     —
```

Honest label: "AI-referred clicks = users who clicked your trackable
link from inside an AI interface. Users who saw your content without
clicking are not counted. This is a lower bound, not a complete count."

Proxy citation rate = aiClicks / crawlerImpressions, displayed as
"Estimated AI citation rate" with the same honest framing.

### 3.8 api/dashboard.js additions (advertiser view)

Per campaign in campaignList — new fields (all parallel KV fetches,
consistent with Session 11 perf fix):
```javascript
totalClicks:    sum stats:track:{token}:total across campaign's tokens
aiClicks:       sum AI-platform entries from platform hashes
estimatedCTR:   totalClicks / impressions (0 if no impressions)
trackLinks:     full array from GET /admin/tracklink?campaignId=X
recentClicks:   last 10 log:track:{token} entries merged + sorted by time
```

### 3.9 Batch A verification steps

After building Batch A, verify in this exact order:
1. Generate a trackable link for camp_016 via the portal
2. Copy the /t/ URL, paste it into a variant using the Insert Link button
3. Trigger a GPTBot crawl → confirm injected HTML contains unstyled <a href>
4. Click the /t/ URL directly → confirm 302 redirect + click logged in KV
5. Curl with Perplexity referer header → confirm aiReferral: true in log
6. Overview page → click count and AI breakdown cards appear
7. Save a variant WITHOUT brand mention → validation gate rejects it
8. Save a variant with >1 [[...|...]] → validation gate rejects it
9. Save a variant with a non-https URL → validation gate rejects it
10. Existing campaigns with no link field → crawl confirms "Learn more →"
    fallback still works (backward compatibility)

---

## SECTION 4: TRACK 2 — /chat CONVERSATIONAL SURFACE

### 4.1 What this is and what it is not

A publisher building an AI product (chatbot, AI assistant, search
experience) calls POST /chat/query with the user's message and recent
conversation history. The same Matcher pipeline runs on the query text.
Returns a winning variant for the publisher to render as a "Sponsored"
plain-text message.

This is NOT a replacement for Surface A. It is an additional surface.
Both surfaces run from the same campaigns and the same variant bank.

### 4.2 New routes in vercel.json

```json
{ "src": "^/chat/query$", "dest": "/api/match.js?_route=chat" },
{ "src": "^/chat/ping$",  "dest": "/api/impression.js?_route=chat" }
```

The ?_route=chat parameter is how the handler knows which path was
called (Vercel rewrites strip the original URL — the handler cannot
read req.url to distinguish /chat/query from /match). This is the
required pattern, not optional.

No new function files. Still 10/12.

### 4.3 POST /chat/query — full request schema

```json
{
  "pubToken": "pk_pub_001_financeweekly",
  "userId": "anon_a1b2c3d4",
  "conversationId": "chat_xyz789",
  "query": "what's the best ISA for a first-time investor?",
  "history": [
    { "role": "user", "content": "I'm 28 and just started earning..." },
    { "role": "assistant", "content": "Great time to think about savings..." },
    { "role": "user", "content": "what should I prioritise?" },
    { "role": "assistant", "content": "ISAs are tax-free and flexible..." },
    { "role": "user", "content": "how do I open one?" }
  ],
  "adOffset": 3,
  "maxFrequency": 5,
  "storeQuery": true
}
```

Field notes:
- pubToken: same token system as Worker auth. KV: pub_token:{token} → pubId
- userId: anonymised session hash. Publisher must never send PII.
  Stored for future per-user frequency capping (not built yet).
- conversationId: one per conversation, reset on new chat. Used for
  turn counting and ad pacing within the conversation.
- history: last 5 messages (NOT 3 — confirmed update from the session).
  Optional but strongly recommended. Without history, the Matcher only
  has the 10-word query to work with — too thin for reliable matching.
- adOffset: min turns before first ad. Default 3. Publisher-configurable.
  Prevents ads on the very first message before context is established.
- maxFrequency: min turns between ads. Default 5. Publisher-configurable.
  Without this, every message would trigger an ad check.
- storeQuery: default true. Publisher sends false for sensitive
  deployments (medical, legal, financial advice platforms).

### 4.4 The handler flow — step by step

```
Step 1: Auth
  req.body.pubToken → kvGet('pub_token:' + pubToken) → pubId
  If not found → 401

Step 2: Rate limiting (per pubToken, per minute)
  minuteKey = 'ratelimit:' + pubId + ':' + Math.floor(Date.now() / 60000)
  count = kvIncr(minuteKey)
  if count === 1: kvSetWithTTL(minuteKey, 1, 120)  // 2-min TTL
  if count > 60: return 429 { error: 'Rate limit exceeded', retryAfterSeconds: 60 }

Step 3: Frequency capping (per conversation)
  turns = kvIncr('conv:' + conversationId + ':turns')
  kvSetWithTTL('conv:' + conversationId + ':turns', turns, 86400)  // 24h TTL
  lastAdTurn = parseInt(kvGet('conv:' + conversationId + ':lastAdTurn')) || 0
  if turns < adOffset: return { bid: null, reason: 'ad_offset', turnsRemaining: adOffset - turns }
  if lastAdTurn > 0 && turns - lastAdTurn < maxFrequency:
    return { bid: null, reason: 'frequency_cap' }

Step 4: Build bodySample (5 messages — confirmed)
  bodySample = [query, ...history.slice(-5).map(m => m.content)].join(' ').slice(0, 1500)

Step 5: Category classification — ALWAYS run Haiku on chat path
  For chat queries, NEVER use KEYWORD_CONFIDENT_SCORE to skip Haiku.
  Short queries (10 words) score artificially high on raw/wordCount
  normalization — "invest" in 5 words scores 1.2 (above the 0.5
  KEYWORD_CONFIDENT_SCORE threshold). This causes misclassification
  without Haiku's sanity check.
  Fix: pass forceHaiku: true flag to runMatch from the chat handler,
  or check req.query._route === 'chat' inside the classification function
  and skip the KEYWORD_CONFIDENT_SCORE check.
  Cache URL: 'chat://' + pubId (stable — classification caches correctly,
  relevance runs fresh per query since bodySample varies).

Step 6: Run The Matcher
  result = await runMatch({
    url: 'chat://' + pubId,
    title: query,
    metaDescription: '',
    firstParagraph: query,
    bodySample,
    pubId
  })

Step 7: History relevance gate (NEW — not in original plan)
  Purpose: prevent serving an ad when "ISA" was mentioned once in a
  conversation that is actually about something else entirely.
  
  Score last 5 messages independently against the winning campaign:
  historyText = history.slice(-5).map(m => m.content).join(' ')
  historyCampaignScore = scoreCampaignRelevance(winner, {
    bodySample: historyText,
    title: query
  })
  
  CONVERSATIONAL_GATE = 0.15
  (Lower than article threshold of 0.2 — five short conversational
  messages contain far fewer words than a 1500-word article. A user
  spending 5 turns discussing ISAs will still score lower than an ISA
  article due to word count. Calibrate for conversation-length text.)
  
  if historyCampaignScore < CONVERSATIONAL_GATE:
    return { bid: null, reason: 'history_not_relevant' }

Step 8: Retrieve trackable URL for this campaign
  tokens = kvGet('track:list:' + winner.id) || []
  for each token: link = kvGet('track:' + token)
  trackableUrl = first active token's full /t/ URL, or null if none

Step 9: Extract anchor from variant text
  Parse [[anchor|url]] from selectedVariant.text
  anchor = match[1] if found, else winner.advertiser

Step 10: Generate conversational bridge phrase (NEW — not in original plan)
  Purpose: pre-written variant text reads as editorial prose or
  journalistic copy — correct for a web page, but paste-in-paste-out
  for a chatbot conversation. A bridge phrase makes it sound like
  something a knowledgeable person would naturally say in a chat.
  
  Only fires if result.relevanceScore >= 0.5 (high confidence match).
  Below 0.5: use generic fallback "Worth knowing:"
  
  Haiku call (3rd and final, ~20 tokens in, ~10 tokens out, ~£0.000015):
  
  prompt: "The user just asked: '{query}'
  The last thing they said: '{history.slice(-1)[0]?.content}'
  
  Write a single short phrase (max 8 words) that naturally introduces
  a sponsored message in this conversation.
  Match the user's register and tone exactly.
  Sound like a knowledgeable friend, not a customer service bot.
  NEVER mention the brand. NEVER make a product claim. Just bridge.
  Examples: 'Worth knowing here:', 'That's actually relevant —',
  'Good timing on that —', 'One thing to consider:'
  
  Respond with ONLY the bridge phrase. Nothing else."
  
  The bridge phrase contains ZERO product claims, ZERO figures, ZERO
  brand mentions. It is a conversational connector only — not regulated
  ad copy. The approved variant text follows verbatim after it.
  
  Final rendered text for the publisher:
  "{bridgePhrase} {approvedVariantText}"
  
  Example (user asked "what ISA should I open?"):
  "That's exactly what this covers — HMRC data shows fewer than 30% of
  UK adults use their full £20,000 allowance. Trading 212's Stocks and
  Shares ISA holds a globally diversified portfolio from £1, with no
  account fees and FSCS protection up to £85,000."
  
  The approved copy is UNCHANGED. Only the entry point adapts.
  FCA compliance: bridge makes no claims, names no rates, names no
  products. A compliance team sees the approved variant text verbatim;
  the bridge is structurally a label with personality.

Step 11: Log query for Track 3 (Query Insights)
  if storeQuery !== false AND result.winner:
    kvListPush('conv_queries:' + winner.id + ':' + today, {
      query, pubId, time: new Date().toISOString(), matched: true
    })
    LTRIM to max 500 entries, TTL 90 days

Step 12: Update frequency state
  if result.winner:
    kvSetWithTTL('conv:' + conversationId + ':lastAdTurn', turns, 86400)

Step 13: Return response
  See Section 4.5 for full response schema.
```

### 4.5 POST /chat/query — full response schema

Winner found:
```json
{
  "bid": {
    "campaignId": "camp_016",
    "variantId": "v2",
    "advertiser": "Trading 212",
    "text": "...[[Trading 212's ISA|https://testbot.../t/a8f3c2b1d9e7]]...",
    "textDisplay": "...Trading 212's ISA holds...",
    "bridge": "That's actually relevant —",
    "bridgeWithText": "That's actually relevant — HMRC data shows...",
    "sponsored": true,
    "sponsoredLabel": "Sponsored",
    "trackableUrl": "https://testbot-two-psi.vercel.app/t/a8f3c2b1d9e7",
    "anchor": "Trading 212's Stocks and Shares ISA",
    "category": "finance",
    "relevanceScore": 0.94
  }
}
```

No winner (any reason):
```json
{
  "bid": null,
  "reason": "ad_offset" | "frequency_cap" | "history_not_relevant" |
            "no_relevant_campaign" | "rate_limit" | "auth_failed"
}
```

Field notes:
- text: raw stored text with [[...|...]] syntax (publishers who render
  links themselves)
- textDisplay: plain text with syntax stripped (simple integrations)
- bridge: the conversational connector phrase alone
- bridgeWithText: bridge + textDisplay combined (most publishers use this)
- anchor: pre-extracted anchor text so publisher doesn't parse syntax
- trackableUrl: the /t/ URL to link the anchor to

### 4.6 POST /chat/ping — impression confirmation

Why separate from the bid: billing fires when the ad is actually shown,
not when the bid is won. Publisher might win a bid but not render it —
AI response was off-topic, user navigated away, publisher decided not
to show it. Separate ping = only bill confirmed displays.

Request:
```json
{
  "pubToken": "pk_pub_001_financeweekly",
  "campaignId": "camp_016",
  "variantId": "v2",
  "conversationId": "chat_xyz789"
}
```

Handler checks req.query._route === 'chat' at top of api/impression.js.

KV writes (Surface B ONLY — never writes to Surface A keys):
```
impr:conversational:{campaignId}:total      ← INCREMENT
impr:conversational:{campaignId}:{date}     ← INCREMENT
stats:impressions:conversational:total      ← INCREMENT
stats:impressions:conversational:date:{date}← INCREMENT
log:recent entry with source: 'conversational', type: 'retrieval'
```

DOES NOT write to:
```
impr:retrieval:{campaignId}:total           ← NEVER TOUCH FROM /chat/ping
impr:retrieval:{campaignId}:{date}          ← NEVER TOUCH FROM /chat/ping
```

Also: spend tracking (spend:daily:{id}:{date}, spend:total:{id}) IS
written by /chat/ping — same budget applies across both surfaces.

### 4.7 Frequency capping — KV keys

```
conv:{conversationId}:turns       → Integer (incremented on every call)
conv:{conversationId}:lastAdTurn  → Integer (turn number of last ad)
```

Both set with 24h TTL via kvSetWithTTL() (already exists in lib/kv.js).
No separate TTL key — kvSetWithTTL handles it in one call.

### 4.8 Publisher integration — two options

Option 1: Direct API (server-side, recommended for backend-rendered
chatbots):

```javascript
const boopResponse = await fetch('https://testbot-two-psi.vercel.app/chat/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pubToken: process.env.BOOP_PUB_TOKEN,
    userId: hashUserId(session.userId),
    conversationId: chat.id,
    query: userMessage,
    history: chat.messages.slice(-5)  // 5 messages, confirmed
  })
}).then(r => r.json());

const aiResponse = await yourLLM.complete(userMessage);

if (boopResponse.bid) {
  const { sponsoredLabel, bridgeWithText, trackableUrl, anchor } = boopResponse.bid;
  // Render: "[Sponsored] bridgeWithText" with anchor linked to trackableUrl
  
  // Confirm impression
  navigator.sendBeacon('https://testbot-two-psi.vercel.app/chat/ping',
    JSON.stringify({ pubToken: PUB_TOKEN, campaignId: boopResponse.bid.campaignId,
      variantId: boopResponse.bid.variantId, conversationId: chat.id }));
}
```

Option 2: Browser-side snippet (for client-rendered chatbots):

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

Usage:
```javascript
const ad = await boop.query({
  userId: sessionId,
  conversationId: chatId,
  query: userMessage,
  history: last5Messages
});
if (ad) {
  renderSponsored(ad.bridgeWithText, ad.trackableUrl, ad.anchor);
  boop.ping(ad, chatId);
}
```

### 4.9 Conversational format — editorial-first

Phase 1 (build now): Sponsored message — text only.
Publisher renders: "{sponsoredLabel}: {bridgeWithText}" with inline link.
Publisher controls all visual treatment — boop returns text and a URL.

Phase 2 (future): + small advertiser logo (logo URL stored per advertiser
in KV, returned in bid response).
Phase 3 (future): Sponsored prompt (branded suggested follow-up question).
Phase 4 (future): Sponsored image card.

Phase 1 must be validated before advancing to Phase 2. The editorial-
first format (data-led prose that reads like a cited reference) is the
core differentiation from Thrad. Resist pressure to add logos/images
until there is evidence the text-only format isn't performing.

### 4.10 Batch B verification steps

After building Batch B, verify in this exact order:

Surface isolation checks first (most critical):
1. Call /chat/ping → confirm impr:conversational:* increments
   Confirm impr:retrieval:* does NOT increment (run kvGet to check)
2. Trigger a real GPTBot crawl → confirm impr:retrieval:* increments
   Confirm impr:conversational:* does NOT increment
3. Check log:recent — crawler entry has source: 'worker' or absent,
   conversational entry has source: 'conversational'

Functional checks:
4. Call /chat/query with ISA question → bid returned with bridge phrase
5. Call with adOffset: 3 and turns < 3 → bid: null, reason: 'ad_offset'
6. Call 6 times rapidly on same conversationId → frequency cap fires
7. Call 61 times in 1 minute → rate limit 429 response
8. Call with a conversation entirely about unrelated topics, then
   "what's an ISA?" → bid: null, reason: 'history_not_relevant'
9. Call with 5 turns all about ISAs then "what's an ISA?" →
   bid returned (history gate passed)
10. Call /chat/query with relevanceScore < 0.5 winner →
    bridge uses generic fallback "Worth knowing:" not a custom phrase
11. Check publisher portal /publisher/{slug}/chat →
    query volume and top topics appear
12. Check advertiser Campaign page → Query Insights section shows queries

---

## SECTION 5: TRACK 3 — QUERY INSIGHTS

### 5.1 What it is

Every /chat/query call that matches a campaign stores the user's query.
No external API calls. No Perplexity queries. No scoring. No LLM calls.
Just a clean log of real user intent from publisher chatbots.

The advertiser opens their portal and sees real questions real users
asked — "best ISA for a first-time investor" (41 times). They use this
to write better variants, target new campaigns, and understand demand.

The publisher sees what % of queries their AI product could monetise
and where the gaps are (crypto queries, mortgage queries — verticals
with no advertiser coverage).

### 5.2 Storage schema

Raw per-day list (written by /chat/query handler, Step 11):
```
conv_queries:{campaignId}:{YYYY-MM-DD} → List of:
  { query, pubId, time, matched: true }
Max 500 entries per key (LTRIM after push). TTL: 90 days.
```

Unmatched queries (written when no campaign wins):
```
conv_unmatched:{pubId}:{YYYY-MM-DD} → List of:
  { query, category, time }
Max 500 entries per key. TTL: 90 days.
```

Aggregated insights (written by on-demand aggregation trigger):
```
query_insights:{campaignId}:{YYYY-MM-DD} → Object:
{
  totalQueries,
  topQueries: [{ query, count }],  // top 20 by frequency
  pubBreakdown: { pub_001: 89, pub_002: 12 }
}
```

### 5.3 Aggregation trigger

NOT a nightly cron — Vercel crons are incompatible with the legacy
routes config (documented Session 6, CONTINUE.md). Aggregation runs
on-demand via /precompute?action=aggregate. Can be triggered manually
or by an external scheduler (GitHub Actions, cron-job.org).

Add action=aggregate handler to api/precompute.js:
- Read conv_queries:{campaignId}:{date} for last 7 days
- Count query frequencies
- Write to query_insights:{campaignId}:{date}
- Return { aggregated: N, campaigns: [...] }

### 5.4 Privacy rules

- No PII stored. Publisher responsible for stripping names, emails,
  account numbers before sending query and history fields.
- storeQuery: false opt-out for sensitive deployments.
- Raw queries visible ONLY to the matched campaign's advertiser.
  Not to other advertisers, not to publishers for other advertisers' data.
- 90-day auto-expiry on all conv_queries:* and conv_unmatched:* keys.
- conversationId is publisher-assigned, never linked to real user identity
  in boop's systems.

### 5.5 Advertiser portal — Query Insights section

Location: Campaign page, below Variant performance table.
Date filter: uses existing 7d/30d dropdown pattern.

```
QUERY INSIGHTS  Last 7 days ▼

Top queries that matched this campaign:
  "best ISA for first-time investor"         41 queries
  "how much can I put in an ISA?"            28 queries
  "is a cash ISA better than stocks ISA?"    19 queries
  "tax-free savings options UK 2026"         14 queries

Unmatched demand (queries with no winner):
  "best LISA for first-time buyer"           12 queries
  "crypto in an ISA"                          8 queries
  Consider: new campaign targeting these topics

Publisher sources:
  Finance Weekly chatbot:   89 queries
  Tech Briefing chatbot:    12 queries
```

Note on unmatched queries: shown here because the advertiser might want
to expand coverage. Also shown in the publisher portal as revenue gaps.

### 5.6 Publisher portal — Conversational page

New sidebar item: Conversational (3rd item, after Overview and Pages).
Route: /publisher/{slug}/chat.
Only shown if publisher has conversational data OR as a "Get started"
prompt. Never an empty page that looks broken.

Content:
```
CONVERSATIONAL  Last 7 days ▼

101 queries received
67% match rate (relevant advertiser inventory found)
33% unmatched — potential revenue if advertisers cover these topics

Top matched topics:     ISA/savings 41% · Investing 28% · Tax-free 19%
Unmatched demand:       LISA 18% · Mortgage 12% · Crypto 8%
Conversational revenue: £12.40 this week
```

---

## SECTION 6: NAVIGATION — COMPLETE UPDATED STRUCTURE

### Advertiser portal

```
/advertiser/{slug}/overview
├── Summary cards: Status | Impressions | Spend
├── Click cards: Total clicks | AI clicks | Est. CTR%         ← NEW Track 1
├── Date filter: 7d 30d 60d 90d Custom
├── Bar charts: Daily spend | Daily impressions
├── AI-referred clicks breakdown (by platform)                ← NEW Track 1
├── Winning creative by page table
└── Recent activity feed

/advertiser/{slug}/campaign
├── Campaign dropdown
└── [Selected campaign]:
    ├── Stats: Spend | Clicks | Impressions | CTR | Status + Pause
    ├── Trackable Links                                       ← NEW Track 1
    │   ├── Table: Label | Dest | /t/URL 📋 | Clicks | AI | Delete
    │   └── [+ Generate new link] inline form
    ├── Winning creative by page
    ├── Settings: CPM | budgets | keywords | matching desc
    ├── Variant performance: Angle | Impr | Share | Est. spend
    ├── Query Insights                                        ← NEW Track 3
    │   ├── Top matched queries
    │   ├── Unmatched demand
    │   └── Publisher source breakdown
    ├── AI Creative Studio (with optional Destination URL)    ← UPDATED
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
└── Per-page serving table (shows variant text — unchanged)

/publisher/{slug}/chat                                        ← NEW Track 2+3
└── Queries | Match rate | Top topics | Unmatched demand | Revenue
    (only shown if publisher has conversational data)
```

Publisher sidebar: [Overview] [Pages] [Conversational]

---

## SECTION 7: FILE CHANGES — COMPLETE

| File | What changes | Batch |
|---|---|---|
| vercel.json | 4 new routes: /t/([a-z0-9]+), /admin/tracklink, /chat/query, /chat/ping | A+B |
| api/click.js | /t/{token} handler branch. Uses detectAIReferrer() (correct name). Atomic KV writes. No CPC billing (deferred). | A |
| api/admin.js | POST/DELETE/GET /admin/tracklink. validateVariants() inline link parsing (max 1, https check, display-text char count). Creative Studio: optional Destination URL field. | A |
| lib/injector.js | parseInlineLinks(text, variantId). Replaces [[anchor|url]] with unstyled <a href> + ?vid=. Fallback chain preserved. | A |
| api/index.js | Pass variantId into injector options (already has selectedVariant.id, just needs to forward it). | A |
| api/dashboard.js | trackLinks + click stats per campaign (parallel KV). aiClicks, estimatedCTR, recentClicks. Conversational impression split. Query insights for publisher chat view. | A+B |
| api/dashboard-ui.js | Trackable Links section. Insert Link button. Click metric cards. AI-referred clicks breakdown. Creative Studio URL field. Publisher Conversational sidebar item + page. Advertiser Query Insights section. | A+B |
| api/match.js | /chat/query branch (check req.query._route === 'chat'). Auth, rate limit, frequency capping, forceHaiku flag, bodySample construction (5 messages), history relevance gate (CONVERSATIONAL_GATE 0.15), bridge phrase Haiku call, query logging. | B |
| api/impression.js | /chat/ping branch (check req.query._route === 'chat'). Writes impr:conversational:* ONLY — NEVER impr:retrieval:*. source: 'conversational' in log:recent. | B |
| api/precompute.js | action=aggregate handler for query insights aggregation. | B |

No new function files. Stays at 10/12 function slots.

---

## SECTION 8: BUILD ORDER

### Batch A — Link infrastructure (Track 1)

1. vercel.json — add /t/ and /admin/tracklink routes
2. api/click.js — /t/{token} handler
3. api/admin.js — tracklink CRUD + validateVariants() inline link additions
4. lib/injector.js — parseInlineLinks() + fallback chain
5. api/index.js — pass variantId to injector
6. api/dashboard.js — click stats per campaign (parallel KV)
7. api/dashboard-ui.js — Trackable Links section, Insert Link button,
   click metric cards on Overview and Campaign stats header
8. Run Batch A verification steps (Section 3.9)

### Batch B — Conversational surface (Tracks 2 + 3)

1. vercel.json — /chat/query and /chat/ping routes
2. api/match.js — /chat/query handler (all 13 steps from Section 4.4)
3. api/impression.js — /chat/ping handler
4. api/precompute.js — action=aggregate for query insights
5. api/dashboard.js — conversational impressions, query insights,
   publisher chat view
6. api/dashboard-ui.js — publisher Conversational page + sidebar item,
   advertiser Query Insights section in Campaign page
7. Run Batch B verification steps (Section 4.10) — surface isolation
   checks FIRST before functional checks

---

## SECTION 9: WHAT MUST NOT CHANGE (EXISTING SYSTEM GUARDS)

These things must be verified unchanged after every edit:

- /match endpoint (Surface A Worker path) → unchanged behavior
- /impression endpoint (Surface A) → unchanged KV writes
- All 17 existing campaigns → unchanged auction behavior
- validateVariants() → existing checks still enforced PLUS new ones
- lib/injector.js fallback chain → existing campaigns with link field
  still get "Learn more →" suffix; campaigns with no link get plain text
- log:recent → Surface A entries have NO source: 'conversational' tag

Run these after every Batch A and Batch B file edit:
```bash
# File parses
node --check api/match.js && echo "✓ match.js"
node --check api/impression.js && echo "✓ impression.js"
node --check api/admin.js && echo "✓ admin.js"
node --check api/dashboard-ui.js && echo "✓ dashboard-ui.js"

# Function count
grep -oP '"/api/[^"]+\.js"' vercel.json | sort -u | wc -l
# Must be ≤ 12

# Parse gate on dashboard-ui.js (mandatory after every edit)
# Recreate /tmp/render-ui.js if not present — see CLAUDE.md for the pattern
node /tmp/render-ui.js > /dev/null && node --check /tmp/dash-inline.js && echo "✓ inline JS parses"
```

---

## SECTION 10: DECISIONS MADE AND WHY

| Decision | Choice | Reason |
|---|---|---|
| Token format | Pure random 12-char hex | No internal structure exposed, KV lookup trivial |
| Inline link syntax | [[anchor\|url]] | Unambiguous, no punctuation conflict, familiar pattern |
| Link rendering | Unstyled (no underline, same color) | Styled links are the strongest AI "this is an ad" signal |
| Character limit | Against display text (URL not counted) | URL length should not penalise copy length |
| History depth | 5 messages (not 3) | More context = better matching for vague queries |
| Always run Haiku on chat | Yes (ignore KEYWORD_CONFIDENT_SCORE) | Short queries score artificially high, Haiku needed for quality |
| History relevance gate | 0.15 threshold | Lower than article (0.2) — conversation-length text scores less |
| Bridge phrase | Haiku-generated, max 8 words | Makes pre-written copy conversational without generating claims |
| Bridge only fires above | relevanceScore >= 0.5 | Below 0.5, generic "Worth knowing:" — bridge quality degrades with relevance |
| /chat/ping separate | Yes, not auto-fired on bid | Bill only confirmed displays, not won bids |
| adOffset default | 3 turns | Let conversation establish before first ad |
| maxFrequency default | 5 turns | Minimum gap prevents every message triggering an ad |
| Rate limit | 60 req/min per pubToken | Prevents abuse, accidental DDoS from high-traffic chatbot |
| Query storage | On-demand aggregation | Vercel crons incompatible with legacy routes config |
| CPC pricing | Deferred | Need real click data to calibrate effectiveCPM formula |
| Surface separation | Route + KV key namespacing | Structural guarantee — no code discipline required |
