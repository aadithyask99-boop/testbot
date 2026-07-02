// ============================================================
// RELEVANCE — Contextual matching for AI ad injection (Session 3)
// ============================================================
// The hybrid auction: relevance filter + CPM auction within.
//
// Five-layer cascade for runMatch(pageSignals):
//   0. Cache         — match:sha256(url) with 24h TTL
//   1. Publisher tag — if input includes a category, trust it
//   2. Keyword score — weighted taxonomy against page text
//   3. Haiku         — LLM fallback when keyword score < 0.5
//   4. Filter        — score each campaign's relevance to the page;
//                      drop campaigns below threshold (0.3)
//   5. Auction       — runAuctionFromList among the survivors
//
// Failure mode: every layer has a safe fallback. Haiku rate-limit
// or auth failure → use keyword result. Cache failure → recompute.
// The endpoint never throws a 500 because of a classifier failure.
//
// Cost model: ~£0.00003 per Haiku call. Cached 24h per URL hash.
// At 10k unique URLs/day: ~30p/day in LLM costs.
// ============================================================

const crypto = require('crypto');
const { kvGet, kvSetWithTTL, kvIncr } = require('./kv');
const { runAuctionFromList } = require('./auction');

// ============================================================
// CONSTANTS
// ============================================================

const CATEGORIES = ['finance', 'tech'];
const RELEVANCE_THRESHOLD = 0.2;       // Campaign drops out below this.
// Set lenient (0.2) based on demo-page testing: ISA articles use "investing"
// where campaigns might keyword on "investment", "broker" vs "brokerage", etc.
// Real campaigns can tighten by writing better keyword lists. Tune UP only
// after observing irrelevant ads slipping through in production.
const KEYWORD_CONFIDENT_SCORE = 0.5;   // Above this → skip Haiku
const CACHE_TTL_SECONDS = 86400;       // 24h

// ============================================================
// TAXONOMY — used by Layer 2 keyword scoring
// ============================================================
// Weights: tier1 = 10 (strong signal), tier2 = 6 (supporting signal).
// Match is case-insensitive substring against title + meta + first paragraph.
// Empirically: ISA article scores finance ~0.4-0.8, tech ~0.02.
// VPN article scores tech ~0.3-0.6, finance ~0.01.
// ============================================================
const TAXONOMY = {
  finance: {
    tier1: ['isa', 'pension', 'sipp', 'stocks', 'shares', 'etf', 'dividend',
            'tax-free', 'hmrc', 'wealth'],
    tier2: ['investment', 'investing', 'savings', 'fund', 'trading', 'broker',
            'portfolio', 'retirement', 'mortgage', 'tax', 'income', 'capital',
            'financial', 'finance'],
  },
  tech: {
    tier1: ['vpn', 'saas', 'kubernetes', 'docker', 'react', 'python', 'github',
            'developer tools', 'cloud computing', 'broadband', 'smartphone',
            'router', 'fibre', 'wi-fi'],
    tier2: ['software', 'developer', 'cybersecurity', 'startup', 'machine learning',
            'ai model', 'mobile app', 'database', 'devops', 'open source',
            'privacy', 'encryption', 'internet', 'mobile', 'app', 'device',
            'streaming', 'connectivity', '5g', 'processor'],
  },
};

// ============================================================
// LAYER 2: Keyword scoring
// ============================================================
function scoreCategoryByKeywords({ title, metaDescription, firstParagraph }) {
  const text = ((title || '') + ' ' + (metaDescription || '') + ' ' + (firstParagraph || ''))
    .toLowerCase();
  const wordCount = Math.max(1, text.split(/\s+/).filter(w => w.length > 0).length);

  const scores = {};
  for (const cat of CATEGORIES) {
    const tiers = TAXONOMY[cat];
    let raw = 0;
    for (const w of tiers.tier1) if (text.includes(w)) raw += 10;
    for (const w of tiers.tier2) if (text.includes(w)) raw += 6;
    scores[cat] = raw / wordCount;
  }

  // Pick the winner; if all zero, classify as 'other'
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topCat, topScore] = ranked[0];
  return {
    category: topScore > 0 ? topCat : 'other',
    score: topScore,
    allScores: scores,
  };
}

// ============================================================
// LAYER 3: Haiku classification
// ============================================================
// Single API call, ~50 tokens. One-word answer.
// Returns 'finance', 'tech', 'other', or null on failure (caller falls back).
async function classifyWithHaiku({ title, metaDescription, firstParagraph, bodySample }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY missing — Haiku skipped, falling back to keyword');
    return null;
  }

  // Use bodySample (~1500 chars) if available; falls back to firstParagraph.
  // More text = more accurate category classification, still token-light.
  const excerpt = bodySample || firstParagraph || '(none)';

  const prompt = `Classify the page below as one word: "finance", "tech", or "other".

Title: ${title || '(none)'}
Description: ${metaDescription || '(none)'}
Excerpt: ${excerpt}

One word only.`;

  try {
    // 8-second timeout — Haiku usually responds in <500ms, but bail rather
    // than hang the publisher's response if Anthropic is slow.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 10,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('Haiku HTTP error:', resp.status, await resp.text().catch(() => ''));
      return null;
    }
    const data = await resp.json();
    const text = (data.content?.[0]?.text || '').toLowerCase().trim();

    // Whitelist parse — never trust a free-form LLM response to match a category
    if (text.includes('finance')) return 'finance';
    if (text.includes('tech')) return 'tech';
    return 'other';

  } catch (e) {
    console.error('Haiku call failed:', e.message);
    return null;
  }
}

// ============================================================
// LAYER 4b: Haiku per-campaign relevance precision filter
// ============================================================
// Called when the keyword pre-filter leaves 2+ candidate campaigns.
// Sends them all to Haiku in a single batched call, asks which are
// genuinely relevant to the page, returns the surviving candidates.
//
// Inputs Haiku sees per candidate:
//   - Targeting (matchingDescription) — what the advertiser says it's for
//   - Ad copy (text) — what gets injected, what AI systems read
// Both signals because they're different questions:
//   - Targeting → "is this campaign aimed at this audience?"
//   - Ad copy   → "does the actual injected paragraph fit this article?"
//
// Letter IDs (A, B, C…) keep the prompt short and avoid leaking
// campaign IDs into LLM logs. We map back on our side.
//
// Strict-mode prompt: instructs Haiku to reject UK/US, vertical,
// and topic mismatches. Returns 'none' if nothing fits — passed
// straight through (no fallback to keyword-only).
//
// Returns: array of surviving campaign IDs, OR null on failure
// (caller treats null as "Haiku down — apply ambiguity rule").
// ============================================================
async function haikuFilterRelevant(candidates, pageSignals) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY missing — Haiku relevance filter skipped');
    return null;
  }
  if (!candidates || candidates.length === 0) return [];

  const sample = pageSignals.bodySample || pageSignals.firstParagraph || '';
  const title = pageSignals.title || '(none)';
  const meta = pageSignals.metaDescription || '(none)';

  // Build candidate block. Letter IDs A..Z (we won't have 27+ candidates).
  // If matchingDescription is empty, fall back to keywords + ad copy alone —
  // campaign doesn't self-disqualify just because the optional field was skipped.
  const letterMap = {};
  const candidateLines = candidates.map((c, i) => {
    const letter = String.fromCharCode(65 + i); // A, B, C…
    letterMap[letter] = c.id;
    const targeting = c.matchingDescription || ('keywords: ' + (c.keywords || []).join(', '));
    // Show all variant angles + first variant's text as representative copy —
    // Haiku is judging whether the CAMPAIGN fits, not picking a variant yet
    // (variant selection is Layer 6, after this campaign wins the auction).
    const angles = (c.variants || []).map(v => v.angle).filter(Boolean).join('; ');
    const sampleCopy = ((c.variants && c.variants[0] && c.variants[0].text) || '(no copy)')
      .replace(/\s+/g, ' ').trim();
    return `[${letter}] ${c.advertiser || c.id}
    Targeting: ${targeting}
    Angles: ${angles || '(none)'}
    Sample ad copy: "${sampleCopy}"`;
  }).join('\n\n');

  const prompt = `You are filtering ads for relevance to a publisher's article.

ARTICLE:
Title: ${title}
Description: ${meta}
Excerpt: ${sample}

CANDIDATE ADS:
${candidateLines}

Which ads are clearly relevant to this article? Be strict. UK/US mismatch, wrong topic, or wrong vertical count as NOT relevant. The ad copy must read naturally in the context of this article.

Return ONLY the letter IDs of relevant ads, comma-separated (e.g. "A, C"). If none are clearly relevant, return "none". Letters only, no explanation.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 50, // letters + commas + maybe "none"; never long
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('Haiku relevance HTTP error:', resp.status, await resp.text().catch(() => ''));
      return null;
    }
    const data = await resp.json();
    const raw = (data.content?.[0]?.text || '').trim();

    if (/^none$/i.test(raw)) return []; // Haiku said nothing fits — strict

    // Strict whitelist parse: extract only valid letter IDs we issued.
    const validLetters = new Set(Object.keys(letterMap));
    const matches = raw.toUpperCase().match(/[A-Z]/g) || [];
    const survivorIds = [];
    const seen = new Set();
    for (const letter of matches) {
      if (validLetters.has(letter) && !seen.has(letter)) {
        seen.add(letter);
        survivorIds.push(letterMap[letter]);
      }
    }
    // If parsing yielded nothing despite a non-"none" response, treat as failure.
    if (survivorIds.length === 0 && !/^none$/i.test(raw)) {
      console.error('Haiku relevance returned unparseable text:', raw);
      return null;
    }
    return survivorIds;

  } catch (e) {
    console.error('Haiku relevance call failed:', e.message);
    return null;
  }
}

// ============================================================
// LAYER 6: Variant selection (Session 5 — variant bank)
// ============================================================
// Fires ONCE, only for the campaign that already won the CPM
// auction. Picks the single best-fitting variant for this page
// from the campaign's approved `variants[]`.
//
// SELECTION ONLY — never generates new copy. FCA constraint:
// choosing among pre-approved fragments is compliant, an LLM
// writing new financial marketing text is not.
//
// Cache: variant:{sha256(url|campaignId)}, 24h TTL. Keyed on
// campaign too — if a different campaign wins this URL later
// (budget exhausted, paused, etc.) the old cache entry is simply
// unused, no invalidation needed.
//
// Fallback: round-robin via variant-rotation:{campaignId} (atomic
// kvIncr) if Haiku is unavailable or returns something unparseable.
// Round-robin guarantees even rotation across variants over time.
// ============================================================
async function selectVariant(winner, pageSignals) {
  const variants = winner.variants || [];
  if (variants.length === 0) {
    // Should never happen — isEligible() requires non-empty variants.
    return { variant: null, variantId: null, method: 'none' };
  }

  if (variants.length === 1) {
    return { variant: variants[0], variantId: variants[0].id, method: 'only_option' };
  }

  const cacheKey = 'variant:' +
    crypto.createHash('sha256').update((pageSignals.url || '') + '|' + winner.id).digest('hex');

  try {
    const cached = await kvGet(cacheKey);
    if (cached && cached.variantId) {
      const v = variants.find(x => x.id === cached.variantId);
      if (v) return { variant: v, variantId: v.id, method: cached.method + '_cached' };
      // Cached variant no longer exists (campaign edited) — fall through, recompute.
    }
  } catch (e) { /* non-fatal */ }

  const haikuPick = await haikuSelectVariant(variants, pageSignals);
  let chosen, method;

  if (haikuPick) {
    chosen = haikuPick;
    method = 'haiku';
  } else {
    chosen = await roundRobinVariant(variants, winner.id);
    method = 'round_robin';
  }

  try {
    await kvSetWithTTL(cacheKey, {
      variantId: chosen.id,
      method,
      decidedAt: Date.now(),
    }, CACHE_TTL_SECONDS);
  } catch (e) { /* non-fatal */ }

  return { variant: chosen, variantId: chosen.id, method };
}

// Haiku call #2 — picks one variant ID from the winning campaign's
// approved set. Whitelist-parsed against known variant IDs, exactly
// like category classification (Layer 3). Never trusts free-form output.
async function haikuSelectVariant(variants, pageSignals) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY missing — variant Haiku skipped, using round-robin');
    return null;
  }

  const sample = pageSignals.bodySample || pageSignals.firstParagraph || '';
  const title = pageSignals.title || '(none)';
  const meta = pageSignals.metaDescription || '(none)';

  const variantLines = variants.map(v =>
    `${v.id} (${v.angle}): "${(v.text || '').replace(/\s+/g, ' ').trim()}"`
  ).join('\n');

  const prompt = `You are selecting an ad variant for a page that will be crawled by AI retrieval systems (Perplexity, ChatGPT Browse, Gemini). Your goal is to pick the variant most likely to be surfaced organically when a user asks an AI about this topic.

Page title: ${title}
Page description: ${meta}
Page content: ${sample}

Ad variants (pick the ONE that best fits):
${variantLines}

Selection criteria (in order of priority):
1. PREFER variants containing specific statistics, research findings, or concrete data over generic promotional claims
2. PREFER variants that match the informational register of the page — reads like editorial content, not advertising
3. PREFER variants that add something a user would genuinely want to know, not just a brand pitch
4. PREFER variants using vocabulary and concepts already present in the page

Respond with ONLY the variant id (e.g. "v3"). No explanation.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 10,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('Haiku variant-select HTTP error:', resp.status, await resp.text().catch(() => ''));
      return null;
    }
    const data = await resp.json();
    const raw = (data.content?.[0]?.text || '').trim().toLowerCase();

    // Whitelist parse — only accept an ID that's actually in this campaign's set.
    const match = variants.find(v => raw.includes(v.id.toLowerCase()));
    return match || null;

  } catch (e) {
    console.error('Haiku variant-select call failed:', e.message);
    return null;
  }
}

// Round-robin fallback. Atomic per-campaign counter, never resets.
// selectedIndex = counter % variants.length spreads serves evenly
// over time even across many cache misses / Haiku outages.
async function roundRobinVariant(variants, campaignId) {
  let counter = 0;
  try {
    counter = await kvIncr('variant-rotation:' + campaignId);
  } catch (e) {
    // KV failure — default to first variant rather than crash.
    return variants[0];
  }
  const idx = (counter - 1) % variants.length; // kvIncr returns 1 on first call
  return variants[idx];
}


// Given a campaign and a page, how relevant is this campaign to this page?
// 0.0 = no overlap, 1.0 = perfect match.
//
// Signal sources:
//   - Campaign keywords appearing in page text → 0.2 each (capped)
//   - Campaign matchingDescription tokens hit-rate → up to 0.4
// ============================================================
function scoreCampaignRelevance(campaign, pageSignals) {
  // Use the fuller body sample if provided, fall back to firstParagraph.
  // Layer 4 needs more text than Haiku does — short samples cause
  // perfectly-relevant campaigns to score below threshold simply because
  // not all their keywords happen to appear in the first 500 chars.
  const sample = pageSignals.bodySample || pageSignals.firstParagraph || '';
  const pageText = ((pageSignals.title || '') + ' ' +
                    (pageSignals.metaDescription || '') + ' ' +
                    sample).toLowerCase();

  let score = 0;

  // Signal 1: campaign keywords in page (up to 0.6 from 3 hits)
  let keywordHits = 0;
  for (const kw of (campaign.keywords || [])) {
    if (kw && pageText.includes(String(kw).toLowerCase())) {
      keywordHits++;
      score += 0.2;
    }
  }

  // Signal 2: matchingDescription tokens hit-rate (up to 0.4)
  const descTokens = (campaign.matchingDescription || '')
    .toLowerCase()
    .split(/[\s,;.]+/)
    .filter(t => t.length > 3);
  if (descTokens.length > 0) {
    let descHits = 0;
    for (const t of descTokens) if (pageText.includes(t)) descHits++;
    score += 0.4 * (descHits / descTokens.length);
  }

  return Math.min(1.0, score);
}

// ============================================================
// LAYER 5 wrapper: run the auction for a category, with relevance filter
// ============================================================
async function runAuctionForCategory(category, pageSignals, meta = {}) {
  if (category === 'other') {
    return { winner: null, category, reason: 'other_category', ...meta };
  }
  if (!CATEGORIES.includes(category)) {
    return { winner: null, category, reason: 'unknown_category', ...meta };
  }

  const ids = (await kvGet('campaigns:' + category)) || [];
  if (!ids.length) {
    return { winner: null, category, reason: 'no_campaigns_in_category', ...meta };
  }

  const allCampaigns = (await Promise.all(ids.map(id => kvGet('campaign:' + id))))
    .filter(c => c && c.active);

  if (allCampaigns.length === 0) {
    return { winner: null, category, reason: 'no_active_campaigns', ...meta };
  }

  // ─── STAGE 1: keyword pre-filter (free, fast) ──────────────
  // Cheap rough cut. Kills obvious mismatches before paying for Haiku.
  // Survivors are not yet committed to serve — Haiku gets the final say.
  const keywordScored = allCampaigns.map(c => ({
    ...c,
    relevanceScore: scoreCampaignRelevance(c, pageSignals),
  }));
  const keywordSurvivors = keywordScored.filter(c => c.relevanceScore >= RELEVANCE_THRESHOLD);

  // Candidate breakdown: track every campaign's fate through the stages so
  // the dashboard's live board can show WHO competed and WHY each won/lost.
  // outcome: 'won' | 'eligible' | 'filtered_keyword' | 'filtered_haiku' | 'over_budget'
  // This is built from the SINGLE real auction — the dashboard never recomputes.
  function buildBreakdown(finalSurvivorIds, winnerId, overBudgetIds) {
    return keywordScored.map(c => {
      let outcome;
      if (c.id === winnerId) outcome = 'won';
      else if (c.relevanceScore < RELEVANCE_THRESHOLD) outcome = 'filtered_keyword';
      else if (finalSurvivorIds && !finalSurvivorIds.has(c.id)) outcome = 'filtered_haiku';
      else if (overBudgetIds && overBudgetIds.has(c.id)) outcome = 'over_budget';
      else outcome = 'eligible'; // passed all filters but didn't win the CPM pick
      return {
        id: c.id,
        advertiser: c.advertiser,
        cpmGBP: c.cpmGBP || 0,
        relevanceScore: Math.round((c.relevanceScore || 0) * 100) / 100,
        outcome,
      };
    });
  }

  if (keywordSurvivors.length === 0) {
    return {
      winner: null,
      category,
      reason: 'no_relevant_campaign',
      candidates: buildBreakdown(null, null, null),
      ...meta,
    };
  }

  // ─── STAGE 2: Haiku precision filter (only if ambiguous) ───
  // - 1 survivor: no ambiguity, no Haiku needed. Serve it.
  // - 2+ survivors: Haiku decides which are actually relevant.
  //   If Haiku fails (timeout/auth), strict rule: serve nothing
  //   when ambiguous. We trust keyword pre-filter for clear winners,
  //   not for tie-breaking.
  let finalSurvivors = keywordSurvivors;
  let haikuUsed = false;
  let haikuFailed = false;

  if (keywordSurvivors.length > 1) {
    // Cache key: URL + sorted candidate IDs. New campaign joining the
    // candidate set invalidates the cached decision (gets a fair chance).
    const candidateIds = keywordSurvivors.map(c => c.id).sort().join(',');
    const relCacheKey = 'match-rel:' +
      crypto.createHash('sha256').update((pageSignals.url || '') + '|' + candidateIds).digest('hex');

    let cachedRel = null;
    try {
      cachedRel = await kvGet(relCacheKey);
    } catch (e) { /* non-fatal */ }

    let survivorIds;
    if (cachedRel && Array.isArray(cachedRel.survivorIds)) {
      survivorIds = cachedRel.survivorIds;
      haikuUsed = true; // result from a previous Haiku call, still attributed to Haiku
    } else {
      const haikuResult = await haikuFilterRelevant(keywordSurvivors, pageSignals);
      if (haikuResult === null) {
        // Haiku failed and we have ambiguity → strict: serve nothing.
        haikuFailed = true;
        return {
          winner: null,
          category,
          reason: 'haiku_failed_with_ambiguity',
          candidateCount: keywordSurvivors.length,
          candidates: buildBreakdown(null, null, null),
          ...meta,
        };
      }
      survivorIds = haikuResult;
      haikuUsed = true;
      // Cache the result for 24h. Even an empty array is cacheable —
      // "Haiku says none relevant" is a valid stable answer.
      try {
        await kvSetWithTTL(relCacheKey, {
          survivorIds,
          decidedAt: Date.now(),
        }, CACHE_TTL_SECONDS);
      } catch (e) { /* non-fatal */ }
    }

    const surviveSet = new Set(survivorIds);
    finalSurvivors = keywordSurvivors.filter(c => surviveSet.has(c.id));

    if (finalSurvivors.length === 0) {
      return {
        winner: null,
        category,
        reason: 'haiku_filtered_all',
        candidates: buildBreakdown(new Set(), null, null),
        ...meta,
        haikuUsed,
      };
    }
  }

  // ─── STAGE 3: CPM auction among final survivors ────────────
  const finalSurvivorIdSet = new Set(finalSurvivors.map(c => c.id));
  const winner = await runAuctionFromList(finalSurvivors);
  if (!winner) {
    // Everyone relevant was over budget. Mark all final survivors over_budget.
    const overBudget = new Set(finalSurvivors.map(c => c.id));
    return {
      winner: null,
      category,
      reason: 'all_over_budget',
      candidates: buildBreakdown(finalSurvivorIdSet, null, overBudget),
      ...meta,
      haikuUsed,
    };
  }

  // ─── LAYER 6: variant selection (winner only) ──────────────
  const { variant, variantId, method: variantMethod } = await selectVariant(winner, pageSignals);

  return {
    winner,
    category,
    relevanceScore: winner.relevanceScore,
    competitorCount: finalSurvivors.length,
    candidates: buildBreakdown(finalSurvivorIdSet, winner.id, null),
    haikuUsed,
    selectedVariant: variant,
    selectedVariantId: variantId,
    variantMethod,
    ...meta,
  };
}

// ============================================================
// classifyOnly(pageSignals) — Layers 0-3 ONLY (category classification)
// ============================================================
// Extracted from runMatch (Session 6) so the precompute sweep can warm
// the classification cache without running the auction (Layers 4-6),
// which depends on live campaign state and should NOT be precomputed.
//
// Returns: { category, method, cached, classifiedAt, keywordScore?,
//            keywordAllScores? }
//
// Side effect: on a cache MISS, writes BOTH:
//   - match:{sha256(url)}       (existing key — live crawls read this)
//   - precompute:{sha256(url)}  (new key — coverage/diagnostics only,
//                                 same TTL, written alongside match: so
//                                 the two never drift apart)
// On a cache HIT where precompute: is missing, backfills precompute:
// from the cached match: entry (source: 'backfill') — see inline
// comment below for why.
// ============================================================
async function classifyOnly(pageSignals) {
  const { url, publisherCategory } = pageSignals;
  if (!url) {
    return { category: null, method: null, cached: false, reason: 'missing_url' };
  }

  const cacheKey = 'match:' + crypto.createHash('sha256').update(url).digest('hex');
  const precomputeKey = 'precompute:' + crypto.createHash('sha256').update(url).digest('hex');

  // ─── LAYER 0: cache ────────────────────────────────────────
  try {
    const cached = await kvGet(cacheKey);
    if (cached && cached.category) {
      // Backfill precompute: if it's missing — this happens when match:
      // was populated by a LIVE crawl (api/index.js) before precompute:
      // existed, or before a sweep ever ran for this URL. Without this,
      // the coverage card under-reports pages that were classified via
      // a real bot crawl rather than a sweep. Best-effort, non-fatal.
      try {
        const existingPrecompute = await kvGet(precomputeKey);
        if (!existingPrecompute) {
          await kvSetWithTTL(precomputeKey, {
            category: cached.category,
            method: cached.method,
            classifiedAt: cached.classifiedAt || Date.now(),
            source: 'backfill',
          }, CACHE_TTL_SECONDS);
        }
      } catch (e) { /* non-fatal */ }
      return {
        category: cached.category,
        method: cached.method,
        cached: true,
        classifiedAt: cached.classifiedAt,
      };
    }
  } catch (e) {
    console.error('Match cache read error:', e.message);
  }

  // ─── LAYER 1: publisher tag ────────────────────────────────
  if (publisherCategory && CATEGORIES.includes(publisherCategory)) {
    const entry = { category: publisherCategory, method: 'publisher_tag', classifiedAt: Date.now() };
    try {
      await kvSetWithTTL(cacheKey, entry, CACHE_TTL_SECONDS);
      await kvSetWithTTL(precomputeKey, { ...entry, source: pageSignals.precomputeSource || 'live' }, CACHE_TTL_SECONDS);
    } catch (e) { /* non-fatal */ }
    return { ...entry, cached: false };
  }

  // ─── LAYER 2: keyword scoring ──────────────────────────────
  const kw = scoreCategoryByKeywords(pageSignals);
  let finalCategory = kw.category;
  let method = 'keyword';

  // If confident from keywords alone, skip Haiku
  if (kw.score < KEYWORD_CONFIDENT_SCORE || kw.category === 'other') {
    // ─── LAYER 3: Haiku ─────────────────────────────────────
    const haikuResult = await classifyWithHaiku(pageSignals);
    if (haikuResult) {
      finalCategory = haikuResult;
      method = 'haiku';
    } else {
      method = 'keyword_haiku_fallback';
    }
  }

  const entry = { category: finalCategory, method, classifiedAt: Date.now() };
  try {
    await kvSetWithTTL(cacheKey, entry, CACHE_TTL_SECONDS);
    await kvSetWithTTL(precomputeKey, { ...entry, source: pageSignals.precomputeSource || 'live' }, CACHE_TTL_SECONDS);
  } catch (e) { /* non-fatal */ }

  return { ...entry, cached: false, keywordScore: kw.score, keywordAllScores: kw.allScores };
}

// ============================================================
// CORE ENTRY POINT — runMatch(pageSignals)
// ============================================================
// pageSignals: { url, title, metaDescription, firstParagraph, publisherCategory? }
// Returns: { winner, category, method, ...meta } — winner is the campaign or null.
// ============================================================
async function runMatch(pageSignals) {
  const { url } = pageSignals;
  if (!url) {
    return { winner: null, category: null, reason: 'missing_url' };
  }

  // ─── LAYERS 0-3: classification (cache-aware) ──────────────
  const classified = await classifyOnly(pageSignals);
  if (!classified.category) {
    return { winner: null, category: null, reason: classified.reason || 'classification_failed' };
  }

  // ─── LAYERS 4-6: relevance filter, auction, variant select ──
  return await runAuctionForCategory(classified.category, pageSignals, {
    method: classified.method,
    cached: classified.cached,
    classifiedAt: classified.classifiedAt,
    keywordScore: classified.keywordScore,
    keywordAllScores: classified.keywordAllScores,
  });
}

// ============================================================
// CONVERSATIONAL MATCH — Query-Relevance First Auction (Session 13)
// ============================================================
// Different from runMatch (which is crawl-time, CPM-waterfall-first).
//
// For live chat queries:
//   1. Collect ALL active variants across ALL campaigns in the category
//   2. Score every variant directly against the query via Haiku
//      (single batched call — all variants scored in one prompt)
//   3. Rank by: queryScore × 0.7 + normalisedCPM × 0.3
//      (relevance dominates; CPM breaks ties and protects revenue floor)
//   4. Winner is the highest-scoring variant whose campaign has budget
//   5. Optional rewrite pass: Haiku rewrites the variant to conversational
//      tone — preserving every number, statistic, and brand name verbatim
//
// Fallback: if Haiku fails, falls back to standard runMatch pipeline.
// ============================================================

const CONV_RELEVANCE_WEIGHT = 0.7;
const CONV_CPM_WEIGHT       = 0.3;
const CONV_SCORE_THRESHOLD  = 0.3; // Variants below this are excluded

// Score every variant for the live query in one Haiku call.
// Returns array of { campaignId, variantId, angle, text, queryScore } sorted descending.
async function scoreVariantsForQuery(allVariants, query, history) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || allVariants.length === 0) return [];

  // Truncate to keep prompt under ~3k tokens (Haiku handles up to 200k but
  // shorter prompts are faster + cheaper). Max 30 variants batched at once.
  const batch = allVariants.slice(0, 30);
  const historySnippet = (history || []).slice(-3).map(m => m.content || '').join(' ').slice(0, 300);

  const lines = batch.map((v, i) =>
    `[${String.fromCharCode(65 + i)}] ${v.angle}: ${v.text.slice(0, 180)}`
  ).join('\n');

  const prompt =
    'A user in a chat conversation asked: "' + query + '"\n' +
    (historySnippet ? 'Recent context: "' + historySnippet + '"\n' : '') +
    '\nRate how well each of the following sponsored messages would genuinely help answer or add value to that question. ' +
    'Score 0.0 (irrelevant) to 1.0 (directly answers the question). ' +
    'Prefer messages with specific statistics, named sources, or concrete data. ' +
    'Penalise purely promotional language with no informational value.\n\n' +
    lines + '\n\n' +
    'Respond with ONLY a JSON array of scores in order, e.g. [0.9,0.2,0.7]. No other text.';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.error('scoreVariantsForQuery HTTP error:', resp.status);
      return [];
    }
    const data = await resp.json();
    const raw = (data.content?.[0]?.text || '').trim();

    // Parse JSON array — strict whitelist: only numbers in [0,1]
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (!Array.isArray(parsed)) return [];

    return batch.map((v, i) => ({
      ...v,
      queryScore: typeof parsed[i] === 'number'
        ? Math.max(0, Math.min(1, parsed[i]))
        : 0,
    }));
  } catch (e) {
    console.error('scoreVariantsForQuery failed:', e.message);
    return [];
  }
}

// Optional rewrite pass — takes winning variant text and rewrites it to
// sound natural in the conversation WITHOUT changing any facts.
// Returns rewritten text, or original text if Haiku fails.
async function rewriteVariantForConversation(variantText, query, advertiser) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return variantText;

  const prompt =
    'The user asked: "' + query + '"\n\n' +
    'Here is approved sponsored content from ' + advertiser + ':\n"' + variantText + '"\n\n' +
    'Rewrite this as a natural, helpful conversational response that directly addresses the user\'s question. Rules:\n' +
    '1. Preserve EVERY number, percentage, statistic, and named source exactly as written\n' +
    '2. Preserve the brand name exactly\n' +
    '3. Do not add ANY information not in the original\n' +
    '4. Do not use promotional language (no "try", "sign up", "discover")\n' +
    '5. Sound like a knowledgeable friend sharing a relevant fact\n' +
    '6. Maximum 2 sentences\n\n' +
    'Output ONLY the rewritten text. Nothing else.';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return variantText;
    const data = await resp.json();
    const rewritten = (data.content?.[0]?.text || '').trim();

    // Safety check: every number in the original must appear in the rewrite.
    // Strip non-digit, non-decimal chars before matching so ??15,000 → 15000
    // matches £15,000 → 15000 (broken pound encoding in KV doesn't trip the check).
    const digitsOnly = s => (s.match(/\d+/g) || []).join('');
    const originalNumbers = variantText.match(/[\d,]+\.?\d*/g) || [];
    const allPreserved = originalNumbers.every(n => rewritten.includes(digitsOnly(n)) || rewritten.includes(n));
    if (!allPreserved || rewritten.length < 20) return variantText;

    // Remove em dashes (per platform rule)
    return rewritten.replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  } catch (e) {
    console.error('rewriteVariantForConversation failed:', e.message);
    return variantText;
  }
}

// Main entry point for conversational surface.
// pageSignals.query = the live user message (required)
// pageSignals.history = last 5 conversation messages
// pageSignals.enableRewrite = true to run conversational rewrite pass
async function runConversationalMatch(pageSignals) {
  const { query, history = [], enableRewrite = false, pubId } = pageSignals;
  if (!query) return { winner: null, reason: 'missing_query' };

  // Step 1: Classify category from query + history context
  const classified = await classifyOnly({
    url: 'chat://' + (pubId || 'unknown'),
    title: query,
    metaDescription: '',
    firstParagraph: query,
    bodySample: [query, ...(history || []).slice(-5).map(m => m.content || '')].join(' ').slice(0, 1500),
    forceHaiku: true, // short queries must always use Haiku
  });

  if (!classified.category || classified.category === 'other') {
    return { winner: null, category: classified.category, reason: 'off_topic' };
  }

  // Step 2: Load all active campaigns in this category
  const { kvGet: _kvGet } = require('./kv');
  const { isEligible, getCampaignSpend } = require('./auction');
  const today = new Date().toISOString().split('T')[0];

  const campaignIds = (await _kvGet('campaigns:' + classified.category)) || [];
  const campaigns = (await Promise.all(
    campaignIds.map(id => _kvGet('campaign:' + id))
  )).filter(c => c && isEligible(c, today));

  if (campaigns.length === 0) {
    return { winner: null, category: classified.category, reason: 'no_eligible_campaigns' };
  }

  // Step 3: Expand all variants from all campaigns into a flat list
  const maxCPM = Math.max(...campaigns.map(c => c.cpmGBP || 0)) || 1;
  const allVariants = [];
  for (const c of campaigns) {
    const spend = await getCampaignSpend(c);
    const dailyBudgetOk = !c.budgetDailyGBP || spend.dailySpendGBP < c.budgetDailyGBP;
    const totalBudgetOk = !c.budgetTotalGBP || spend.totalSpendGBP < c.budgetTotalGBP;
    if (!dailyBudgetOk || !totalBudgetOk) continue; // skip over-budget campaigns
    for (const v of (c.variants || [])) {
      allVariants.push({
        campaignId: c.id,
        variantId: v.id,
        angle: v.angle || '',
        text: v.text || '',
        advertiser: c.advertiser,
        cpmGBP: c.cpmGBP || 0,
        normalisedCPM: (c.cpmGBP || 0) / maxCPM,
        campaign: c,
      });
    }
  }

  if (allVariants.length === 0) {
    return { winner: null, category: classified.category, reason: 'all_over_budget' };
  }

  // Step 4: Score all variants against the live query via Haiku
  const scored = await scoreVariantsForQuery(allVariants, query, history);

  // If Haiku scoring failed, fall back to standard runMatch pipeline
  if (scored.length === 0) {
    console.log('runConversationalMatch: Haiku scoring failed, falling back to runMatch');
    return await runMatch({
      url: 'chat://' + (pubId || 'unknown'),
      title: query,
      metaDescription: '',
      firstParagraph: query,
      bodySample: query,
      forceHaiku: true,
    });
  }

  // Step 5: Compute composite score = queryScore × 0.7 + normalisedCPM × 0.3
  // Filter out variants below threshold, then sort descending
  const ranked = scored
    .map(v => ({
      ...v,
      compositeScore: (v.queryScore * CONV_RELEVANCE_WEIGHT) + (v.normalisedCPM * CONV_CPM_WEIGHT),
    }))
    .filter(v => v.queryScore >= CONV_SCORE_THRESHOLD)
    .sort((a, b) => b.compositeScore - a.compositeScore);

  if (ranked.length === 0) {
    return { winner: null, category: classified.category, reason: 'no_relevant_variants' };
  }

  const best = ranked[0];
  const winMethod = best.queryScore > best.normalisedCPM ? 'won_on_relevance' : 'won_on_bid';

  // Step 6: Optional conversational rewrite pass
  let finalText = best.text;
  let rewritten = false;
  if (enableRewrite) {
    finalText = await rewriteVariantForConversation(best.text, query, best.advertiser);
    rewritten = finalText !== best.text;
  }

  return {
    winner: best.campaign,
    category: classified.category,
    relevanceScore: best.queryScore,
    compositeScore: best.compositeScore,
    winMethod,           // 'won_on_relevance' | 'won_on_bid'
    selectedVariant: { id: best.variantId, angle: best.angle, text: finalText, originalText: best.text },
    selectedVariantId: best.variantId,
    variantMethod: rewritten ? 'haiku_rewrite' : 'direct',
    allVariantsScored: ranked.length,
    topCandidates: ranked.slice(0, 3).map(v => ({
      campaignId: v.campaignId, advertiser: v.advertiser,
      angle: v.angle, queryScore: v.queryScore, compositeScore: v.compositeScore,
    })),
    haikuUsed: true,
    method: classified.method,
    cached: classified.cached,
  };
}


module.exports = {
  runMatch,
  runConversationalMatch,
  scoreVariantsForQuery,
  rewriteVariantForConversation,
  classifyOnly,
  scoreCategoryByKeywords,
  scoreCampaignRelevance,
  classifyWithHaiku,
  haikuFilterRelevant,
  selectVariant,
  haikuSelectVariant,
  roundRobinVariant,
  RELEVANCE_THRESHOLD,
  KEYWORD_CONFIDENT_SCORE,
  CACHE_TTL_SECONDS,
  CATEGORIES,
  TAXONOMY,
};
