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
- `vercel.json` — confirm function count before creating any new files
- `lib/config.js` — understand current defaults
- `api/index.js` — understand the main flow

### Step 3: Confirm the task
Check HANDOVER.md "Immediate Next Tasks" section.
Ask Aadi which task to start with if not obvious.
Do not start coding until the task is confirmed.

### Step 4: Health check (optional but recommended)
```bash
curl https://testbot-two-psi.vercel.app/ | grep -E "Vanguard|Hargreaves|Fidelity" | head -2
curl https://testbot-two-psi.vercel.app/dashboard | python3 -m json.tool | grep -A2 '"summary"'
```

---

## During the session:

- **Check function slot count before creating any new file:**
  ```bash
  grep '"dest"' vercel.json | grep -oP '"/api/[^"]+\.js"' | sort -u | wc -l
  ```
  Must be ≤ 12. Currently 7. 5 free slots remain.

- **Never use `kvJsonUpdate` for counters** — use `kvHashIncr` instead (race condition risk)

- **Never put `require()` inside async handler functions** — always at top of file

- **Never use template literals nested inside template literals** in dashboard-ui.js — use string concatenation

- **Always verify with curl after deployment**, not just local tests

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
- Add any new bugs found to the bug table
- Update "Current State" section
- Add any new open decisions Aadi needs to make
- Update serverless function count if changed

### Step 3: Update CONTINUE.md (only if needed)
- Add entry if a significant mistake was made
- Add entry if something surprising was discovered
- Add entry if an approach was tried and abandoned (so next session doesn't repeat it)
- Don't add trivial entries — only things that genuinely change how we should work

### Step 4: Update CLAUDE.md (only if needed)
- Only if an architectural decision changed
- Only if a new permanent constraint was discovered
- Only if "What's Proven vs Demo" section needs updating

### Step 5: Push everything to GitHub
```bash
git add -A
git commit -m "Session N: [session name] — docs updated"
git push
```

---

## Session naming convention

Use action-oriented names that describe what was built or decided:

Good examples:
- "Understanding Oasy.ai Functionality" (research + POC)
- "Building the Auction System"
- "Contextual Matching with LLM Fallback"
- "Publisher Onboarding and Floor Prices"
- "Cloudflare Worker SDK"

Avoid vague names like "Fixes" or "Updates" — be specific about what changed.

---

## The goal of this system

These docs are the brain of the project. A new Claude Code session reading CLAUDE.md + HANDOVER.md + CONTINUE.md + SESSION_LOG.md should be able to:
1. Understand exactly what was built and why
2. Know what to work on next
3. Not repeat mistakes already made
4. Continue seamlessly as if it was in the room for every previous session

Keep them accurate. Keep them honest. The docs are only useful if they reflect reality.
