# HANDOVER.md — Current State & Next Steps

> This file is the task board and current-state snapshot.
> Update it at the end of every session. It's the first thing to read when picking up work.
> For WHY decisions were made, see CLAUDE.md. For lessons learned, see CONTINUE.md.

---

## Current State (as of end of this thread)

**Live URL:** https://testbot-two-psi.vercel.app  
**Dashboard:** https://testbot-two-psi.vercel.app/ui  
**GitHub:** https://github.com/aadithyask99-boop/testbot (main branch)  
**Vercel:** Hobby plan — 7/12 serverless functions used, 5 free  

### What's deployed and working
- Bot detection + HTML injection — confirmed working across ChatGPT Browse, Perplexity, Grok, Gemini, Meta AI, Claude
- Impression logging — atomic, accurate, per-platform breakdown via Redis HASH
- Click tracking — referrer-based, 5-minute session dedup, 14 platforms, Perplexity query extraction
- Dashboard — three views (operator/advertiser/publisher), 5-second polling, creative update form, verification panel
- Dynamic creative swap — update via dashboard form or POST /admin/creative, live within seconds
- Revenue split — 80/20 (publisher/platform)

### What's a demo placeholder right now
- The "publisher page" is a hardcoded Finance Weekly ISA article in api/index.js — not a real publisher integration
- Only one creative active at a time, stored as `creative:finance_investing`
- No auction system — one advertiser wins by default
- No contextual matching — platform cannot determine page topic
- api/sdk.js is client-side only (headless browser detection) — real server-side publisher middleware not built

---

## All 8 Bugs From Audit — Status

| # | Bug | Status | File |
|---|-----|--------|------|
| 1 | Revenue share hardcoded 60/40 | ✅ FIXED → 80/20 | dashboard.js |
| 2 | Revenue calc used hardcoded £18/£5 CPM | ✅ FIXED → uses currentCreative.cpmGBP | dashboard.js |
| 3 | Unique click race condition (kvJsonUpdate) | ✅ FIXED → kvHashIncr | index.js |
| 4 | Duplicate Google-CloudVertexBot entry | ✅ FIXED → removed duplicate + Googlebot-AI | detector.js |
| 5 | Relative /click URL in injector | ✅ FIXED → absolute via PLATFORM_URL env var | injector.js |
| 6 | class="editorial-note" in sdk.js | ✅ FIXED → plain createElement('p') | sdk.js |
| 7 | requestsPerMinute always 1 | ⚠️ ACKNOWLEDGED → comment added, not fixed | index.js |
| 8 | config.detectionThreshold never read | ✅ FIXED → combined-detector reads it | combined-detector.js |

Bug 7 is a known limitation. The rate signal (+30 pts in behavioural.js) never fires in production. Acceptable for now — UA detection and anonymous_crawler path handle the important cases. Fix later if false negative rate becomes a problem.

---

## Serverless Function Slots

```
USED (7/12):
1. api/index.js         Main detection/injection/logging
2. api/admin.js         Creative management + /ad endpoint
3. api/dashboard.js     Analytics API
4. api/dashboard-ui.js  Visual dashboard
5. api/click.js         Click redirect + tracking
6. api/sdk.js           Publisher client-side snippet
7. api/utils.js         /health + /robots.txt + /sitemap.xml + /ping

FREE (5/12):
8.  → api/match.js      (contextual matching)
9.  → api/campaigns.js  (campaign management + auction)
10. → api/publishers.js (publisher onboarding + floor prices)
11. → spare
12. → spare
```

---

## Immediate Next Tasks (in order)

### Task 1: Campaign schema update
**What:** Update campaign data model to support auction, budgets, and contextual matching.  
**Files:** `lib/config.js`, `api/admin.js`, `api/dashboard.js`, `api/dashboard-ui.js`  
**New campaign object:**
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
  "text": "...",
  "link": "https://hl.co.uk",
  "linkText": "Visit Hargreaves Lansdown",
  "advSlug": "hargreaves-lansdown",
  "active": true,
  "startDate": "2026-06-10",
  "endDate": null,
  "updatedAt": "..."
}
```
**New KV keys:**
- `campaign:{id}` — full campaign object
- `campaigns:finance` — array of campaign IDs in finance category
- `campaigns:tech` — array of campaign IDs in tech category
**Update dashboard form** to include: budget fields, keywords input, active toggle, date fields.

### Task 2: Auction system (api/campaigns.js)
**What:** CPM waterfall auction — sort active campaigns by CPM, first with budget wins.  
**New file:** `api/campaigns.js`  
**Endpoints:**
- `POST /campaigns/create` — create a campaign, store `campaign:{id}`, update `campaigns:{category}` list
- `POST /campaigns/pause` — set active: false
- `GET /campaigns` — list all campaigns with spend status
**Auction logic:**
```
1. Fetch campaigns:{category} → list of IDs
2. Fetch each campaign:{id}
3. Filter: active = true, within date range
4. Sort: cpmGBP descending
5. Walk list: first campaign where spend:daily:{id}:{date} < budgetDailyGBP AND spend:total:{id} < budgetTotalGBP
6. If none pass: return null (no creative served)
```
**Spend tracking:**
- `spend:daily:{id}:{YYYY-MM-DD}` — incremented on each impression, resets daily
- `spend:total:{id}` — incremented on each impression, never resets
- Use `kvHashIncr` for atomic spend tracking
**Update index.js:** replace current creative fetch with auction call. Pass matched category.

### Task 3: Contextual matching (api/match.js)
**What:** Given page signals (title, URL, meta), determine which category and which campaign to serve.  
**New file:** `api/match.js`  
**Input:** `{ title, url, metaDescription, firstParagraph, pubId }`  
**Output:** winning campaign object or null  
**Logic cascade:**
```
Layer 0: Check KV cache → match:{sha256(url)} with 24hr TTL
Layer 1: Publisher explicit tag → if category declared, go to auction
Layer 2: Keyword scoring → weighted term frequency against finance/tech taxonomy
         Finance tier 1 (weight 10): isa, pension, stocks, shares, etf, dividend
         Finance tier 2 (weight 6): investment, investing, savings, fund, trading
         Tech tier 1 (weight 10): api, saas, kubernetes, react, python, github
         Tech tier 2 (weight 6): software, developer, cloud, startup, machine learning
         Score ≥ 0.5 → confident match, go to auction
Layer 3: LLM classification (Claude Haiku) → one word: finance, tech, other
         Only fires if keyword score < 0.5
         Cache result: match:{sha256(url)} → { category, method, cachedAt }
         Cost: ~£0.00003 per call
Layer 4: No match → return null
```
**Important:** Cache by URL hash. Same URL = same classification every time. LLM only called on first visit to each unique URL.

### Task 4: Publisher floor price
**Where to add:** `api/publishers.js` (new file) for publisher management, plus update auction logic  
**KV key:** `publisher:{pubId}` → `{ name, floorCPM, active, ... }`  
**Auction check:** if campaign.cpmGBP < publisher.floorCPM → skip this campaign  
**Floor applies to gross CPM**, not net payout  

### Task 5: Real publisher SDK
**Options (in priority order):**
1. Cloudflare Worker — works for any site, no code changes to publisher site
2. Node.js middleware — for Express/Next.js publishers
3. WordPress plugin — PHP, for the most common CMS

**Cloudflare Worker approach:**
```javascript
export default {
  async fetch(request, env) {
    const response = await fetch(request);
    const ua = request.headers.get('user-agent') || '';
    // Call /match with page signals
    // If bot: inject creative into response HTML
    // If human: return unmodified response
    return response;
  }
};
```
Publisher adds one Cloudflare Worker in front of their existing site. No server changes.

---

## Open Decisions Aadi Needs to Make

- **No campaign match → serve what?** Empty slot (serve nothing), house ad, or fallback? Currently serves nothing.
- **Campaign tiebreaker at identical CPM?** First created wins, or round-robin?
- **LLM for classification:** Claude Haiku or OpenRouter (google/gemini-flash-1.5:free)?
- **Rate signal fix:** implement properly or remove from behavioural.js entirely?
- **Publisher SDK priority:** Cloudflare Worker, Node.js middleware, or WordPress first?

---

## Things to Check at Session Start

1. Is the live site still up? `curl https://testbot-two-psi.vercel.app/` → should return Finance Weekly article with current creative injected
2. What's the current creative? `curl https://testbot-two-psi.vercel.app/admin` → check active advertiser
3. What's the impression count? `curl https://testbot-two-psi.vercel.app/dashboard` → check totalImpressions
4. How many Vercel functions? Check vercel.json → must not exceed 12

---

## How to Seed / Reset for Testing

```bash
# Set creative
curl -X POST https://testbot-two-psi.vercel.app/admin/creative \
  -H "Content-Type: application/json" \
  -d '{"category":"finance_investing","advertiser":"Hargreaves Lansdown","text":"Hargreaves Lansdown is the UK'\''s largest investment platform...","cpmGBP":22,"advSlug":"hl"}'

# Seed default Vanguard creative
curl -X POST https://testbot-two-psi.vercel.app/admin/seed

# Simulate bot impressions
curl -H "User-Agent: Mozilla/5.0 (compatible; PerplexityBot/1.0)" https://testbot-two-psi.vercel.app/
curl -H "User-Agent: Mozilla/5.0 (compatible; GPTBot/1.0)" https://testbot-two-psi.vercel.app/
curl -H "User-Agent: Mozilla/5.0 (compatible; ClaudeBot/1.0)" https://testbot-two-psi.vercel.app/

# Simulate anonymous crawler (DeepSeek pattern)
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" https://testbot-two-psi.vercel.app/

# Check dashboard
curl https://testbot-two-psi.vercel.app/dashboard
curl https://testbot-two-psi.vercel.app/dashboard?view=advertiser
curl https://testbot-two-psi.vercel.app/dashboard?view=publisher
```

---

## Files Changed This Thread (for git reference)

All changes relative to initial deployment:

| File | Change |
|------|--------|
| lib/detector.js | Fixed duplicate Google-CloudVertexBot, removed Googlebot-AI, added Google crawlers, Meta crawlers, Chinese AI systems, xAI-Bot, CCBot, Amazonbot, Applebot-Extended, OAI-AdsBot, Amzn-SearchBot/User |
| lib/combined-detector.js | Added anonymous crawler detection (DeepSeek), added cloakingRisk to return, reads config.detectionThreshold |
| lib/injector.js | Absolute PLATFORM_URL for click tracking, no editorial-note class |
| lib/kv.js | Added kvHashIncr, kvHashGetAll for atomic platform counting |
| lib/referrer.js | Added meta.ai, 14 platforms total |
| api/index.js | Fixed unique click to kvHashIncr, requestsPerMinute comment, full logging pipeline |
| api/admin.js | Added /ad endpoint (folded from ad.js) |
| api/dashboard.js | 80/20 revenue share, uses campaignCPM, three views |
| api/dashboard-ui.js | Full rewrite using string concatenation (no template literals), verification panel |
| api/click.js | New: click redirect + logging |
| api/utils.js | New: consolidation of health + robots + sitemap + ping |
| vercel.json | Updated routes for consolidation |
| api/ad.js | DELETED (folded into admin.js) |
| api/health.js | DELETED (folded into utils.js) |
| api/robots.js | DELETED (folded into utils.js) |
| api/sitemap.js | DELETED (folded into utils.js) |
| api/ping.js | DELETED (folded into utils.js) |
| api/BingSiteAuth.js | DELETED (Bing already verified, file no longer needed) |
