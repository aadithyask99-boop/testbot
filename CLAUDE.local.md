# Session Instructions for Claude Code

This file is read by Claude Code at session start.
The hooks in .claude/settings.json also inject CLAUDE.md, HANDOVER.md, CONTINUE.md, and SESSION_LOG.md automatically.

---

## At the START of every session, do this in order:

### Step 1: Name the session
Ask Aadi: **"What shall we call this session?"**

Then immediately write the session name and date to SESSION_LOG.md as a new entry:
```
## Session N — [Session Name]
**Date:** YYYY-MM-DD
**Goal:** [what Aadi says we're working on today]
```
Fill in the rest of the entry at the end of the session.

### Step 2: Read all project files
You already have CLAUDE.md, HANDOVER.md, CONTINUE.md injected by the session hook.
Also read these files explicitly before touching any code:
- `PLATFORM_STRUCTURE_SPEC.md` — REQUIRED if touching the advertiser portal, publisher
  portal, or matching pipeline. Canonical naming (The Matcher, Variant Bank, Ad Unit,
  Placement, etc.) — read this before using any of these terms in code or conversation.
- `vercel.json` — confirm function count before creating any new files
- `lib/config.js` — understand current defaults
- `lib/relevance.js` — understand the matching cascade (added Session 3)
- `api/index.js` — understand the main flow including match wiring

### Step 3: Confirm the task
Check HANDOVER.md "Immediate Next Tasks" section.
Ask Aadi which task to start with if not obvious.
Do not start coding until the task is confirmed.

### Step 4: Health check (mandatory before any work)
```bash
# Live site responding?
curl -s https://testbot-two-psi.vercel.app/ | head -5

# Env vars loaded?
curl -s https://testbot-two-psi.vercel.app/health | python3 -m json.tool
# expect anthropic_key_set: true, kv_url_set: true

# Per-page board has data?
curl -s "https://testbot-two-psi.vercel.app/dashboard?view=advertiser" | python3 -c "import sys,json;d=json.load(sys.stdin);print('pages:', len(d.get('pageBoard',[]))); print('campaigns:', len(d.get('campaigns',[])))"

# All tests passing? (in repo)
for t in test-auction test-index test-dash test-metrics test-reset test-final test-multipage test-hybrid test-diagnostic test-board; do
  r=$(node /tmp/$t.js 2>&1 | grep "passed.*failed" | tail -1)
  echo "$t: $r"
done
```

If anything fails, stop and diagnose before starting new work.

---

## During the session:

- **Check function slot count before creating any new file:**
  ```bash
  grep '"dest"' vercel.json | grep -oP '"/api/[^"]+\.js"' | sort -u | wc -l
  ```
  Must be ≤ 12. Currently 8/12. 4 free slots.

- **Never use `kvJsonUpdate` for counters** — use `kvHashIncr` instead (race condition risk).

- **Never put `require()` inside async handler functions** — always at top of file.

- **Never use template literals nested inside template literals** in dashboard-ui.js — use string concatenation.

- **After ANY edit to `api/dashboard-ui.js`, run the parse gate:**
  ```bash
  node /tmp/render-ui.js > /dev/null 2>&1 && node --check /tmp/dash-inline.js && echo "✓ parses"
  ```
  If you don't have those scripts in /tmp, recreate them. They're trivial. Don't skip this — the file is a known footgun.

- **Always verify with curl after deployment**, not just local tests.

- **Haiku model name is `claude-haiku-4-5`**, NOT `claude-3-5-haiku-20241022`. If you change models, curl Anthropic directly first to confirm the new name works.

- **Diagnose before redesigning.** The Live Auction Board's per-page candidate breakdown tells you the truth in seconds. Read it before assuming an algorithm is wrong.

---

## At the END of every session, do this before stopping:

### Step 1: Update SESSION_LOG.md
Complete the entry you started at the beginning:
```
**What was built:** [list of files changed and what they do]
**Key decisions made:** [any choices made this session with their reasons]
**Bugs fixed:** [list]
**Where we stopped:** [exact state, what's next]
```

### Step 2: Update HANDOVER.md
- Mark completed tasks with ✅ DONE
- Add any new bugs found to the bug table or new section
- Update "Current State" section
- Add any new open decisions Aadi needs to make
- Update serverless function count if changed
- Update test count if changed

### Step 3: Update CONTINUE.md (only if needed)
- Add entry if a significant mistake was made
- Add entry if something surprising was discovered
- Add entry if an approach was tried and abandoned
- Don't add trivial entries — only things that genuinely change how we should work

### Step 4: Update CLAUDE.md (only if needed)
- Only if an architectural decision changed
- Only if a new permanent constraint was discovered
- Only if "What's Proven vs Demo" section needs updating

### Step 5: Push everything to GitHub
```bash
git add -A
git commit -m "Session N: [session name] — [short summary]"
git push
```

---

## Session naming convention

Use action-oriented names that describe what was built or decided:

Good:
- "Understanding Oasy.ai Functionality" (Session 1 — research + POC)
- "Commercial Layer — Campaigns + Auction + Multi-page Demo" (Session 2)
- "Hybrid Contextual Matching Layer (Keyword + Haiku)" (Session 3)
- "Honest Dashboard + Per-Page Live Auction Board" (Session 4)
- "Variant Bank + Per-Page Variant Selection" (Session 5 planned)
- "Precompute Architecture — Proactive Page Classification" (Session 6 planned)
- "Cloudflare Worker SDK + Publisher Onboarding" (Session 7 planned)

Avoid vague names ("Fixes", "Updates") — be specific.

---

## The goal of this system

These docs are the brain of the project. A new Claude session reading CLAUDE.md + HANDOVER.md + CONTINUE.md + SESSION_LOG.md should be able to:
1. Understand exactly what was built and why
2. Know what to work on next
3. Not repeat mistakes already made
4. Continue seamlessly as if it was in the room for every previous session

Keep them accurate. Keep them honest. The docs are only useful if they reflect reality.

If you find yourself making a decision that contradicts what these docs say, STOP. Either you've discovered something new (update the docs) or you're about to repeat a mistake (read CONTINUE.md again).
