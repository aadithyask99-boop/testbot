# SESSION LOG

Each session gets an entry here. Written by Claude at session end.
Format: session number, name, date, what was built/decided/learned.

---

## Session 1 — Understanding Oasy.ai Functionality
**Date:** 2026-06-09  
**Chat:** Claude.ai (claude.ai chat, not Claude Code)  
**Goal:** Research the competitor (Oasy.ai), understand the business model, build and deploy a working proof of concept.

**What was built:**
- Full bot detection engine (lib/detector.js, lib/combined-detector.js, lib/behavioural.js) covering 40+ AI crawlers
- HTML injection engine (lib/injector.js) — plain `<p>` tag, no fingerprints
- Main serverless handler (api/index.js) — bot path injects creative, human path clean
- Upstash Redis integration (lib/kv.js) with atomic hash operations
- Dynamic creative system — update via API, live within seconds
- Dashboard (api/dashboard.js + api/dashboard-ui.js) — three views, 5-second polling
- Click tracking (lib/referrer.js, api/click.js) — 14 AI platforms, Perplexity query extraction
- Publisher SDK placeholder (api/sdk.js)
- SEO infrastructure — robots.txt, sitemap.xml, Bing verification, IndexNow ping

**What was validated:**
- Injection confirmed working: ChatGPT Browse, Perplexity, Grok, Gemini 2.5 Flash, Meta AI, Claude
- Dynamic creative swap: Vanguard → Fidelity → Hargreaves Lansdown all confirmed
- ChatGPT Browse propagation: ~25 minutes from creative change to AI response update
- Dashboard impressions, clicks, CTR all logging correctly

**Key decisions made:**
- Revenue share: 80/20 (publisher/platform)
- Auction model: first-price CPM waterfall (not RTB)
- Ad categories: Finance and Tech
- Publisher floor price: per-publisher, not global
- CPM adjustable via advertiser panel
- Cloaking policy: Googlebot/GoogleOther excluded, Perplexity/ChatGPT/Grok fine
- Vercel Hobby: 12 function limit — consolidated to 7 functions

**Bugs fixed this session:**
- Revenue share 60/40 → 80/20
- Hardcoded CPM → uses currentCreative.cpmGBP
- Unique click race condition → kvHashIncr
- Duplicate Google-CloudVertexBot entry
- Relative /click URL → absolute via PLATFORM_URL
- editorial-note class → removed
- detectionThreshold → reads from config.js

**Where we stopped:**
- All 8 bugs fixed (bug 7 acknowledged, not fully fixed)
- Serverless functions consolidated: 7/12 used
- Project docs written: CLAUDE.md, CONTINUE.md, HANDOVER.md
- Ready to start Session 2: campaign schema + auction system

---
<!-- Add new sessions below this line -->
