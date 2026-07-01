// ============================================================
// /match — Contextual matching endpoint (Session 3)
// /chat/query — Conversational surface (Session 13, Batch B)
// ============================================================
// Called by:
//   - api/index.js internally (for demo pages)
//   - External publisher Cloudflare Workers
//   - Publisher chatbots via POST /chat/query
//
// POST /match with page signals → winning campaign or null.
// POST /chat/query with query + history → bid or null.
// Route separation: req.query._route === 'chat' → chat branch.
// ============================================================

const { runMatch, scoreCampaignRelevance } = require('../lib/relevance');
const { getPubId } = require('../lib/demo-pages');
const { kvGet, kvSet, kvSetWithTTL, kvIncr, kvListPush } = require('../lib/kv');

const PLATFORM_URL = process.env.PLATFORM_URL || 'https://testbot-two-psi.vercel.app';
const CONVERSATIONAL_GATE = 0.15;  // Lower than article 0.2 — chat text is shorter
const RATE_LIMIT_PER_MIN = 60;

// Resolve pubId from request token or body
async function resolvePubId(body, req) {
  const token = (req.headers && req.headers['x-pub-token']) || body.pubToken || null;
  if (token) {
    const pubId = await kvGet('pub_token:' + token);
    if (pubId) return pubId;
  }
  return body.pubId || null;
}

async function readBody(req) {
  let body = '';
  await new Promise((resolve, reject) => {
    req.on('data', c => body += c);
    req.on('end', resolve);
    req.on('error', reject);
  });
  try { return JSON.parse(body); } catch { return null; }
}

// ── /chat/query handler ────────────────────────────────────────
async function handleChatQuery(req, res, body) {
  // Step 1: Auth — resolve pubId from pubToken
  const pubToken = body.pubToken || (req.headers && req.headers['x-pub-token']) || null;
  const pubId = pubToken ? await kvGet('pub_token:' + pubToken) : null;
  if (!pubId) {
    return res.status(401).json({ bid: null, reason: 'auth_failed' });
  }

  const {
    userId,
    conversationId,
    query,
    history = [],
    adOffset = 3,
    maxFrequency = 5,
    storeQuery = true,
  } = body;

  if (!query || !conversationId) {
    return res.status(400).json({ bid: null, reason: 'query and conversationId are required' });
  }

  // Step 2: Rate limiting — 60 req/min per pubId
  const minuteKey = 'ratelimit:' + pubId + ':' + Math.floor(Date.now() / 60000);
  const reqCount = await kvIncr(minuteKey);
  if (reqCount === 1) {
    // Set 2-min TTL on first request in this minute window
    kvSetWithTTL(minuteKey, reqCount, 120).catch(() => {});
  }
  if (reqCount > RATE_LIMIT_PER_MIN) {
    return res.status(429).json({ bid: null, reason: 'rate_limit', retryAfterSeconds: 60 });
  }

  // Step 3: Frequency capping — per conversation turn counting
  const turnsKey = 'conv:' + conversationId + ':turns';
  const lastAdKey = 'conv:' + conversationId + ':lastAdTurn';
  const turns = await kvIncr(turnsKey);
  kvSetWithTTL(turnsKey, turns, 86400).catch(() => {});

  if (turns < adOffset) {
    return res.status(200).json({ bid: null, reason: 'ad_offset', turnsRemaining: adOffset - turns });
  }
  const lastAdTurn = parseInt(await kvGet(lastAdKey)) || 0;
  if (lastAdTurn > 0 && (turns - lastAdTurn) < maxFrequency) {
    return res.status(200).json({ bid: null, reason: 'frequency_cap' });
  }

  // Step 4: Build bodySample from query + last 5 history messages
  const historyMessages = (history || []).slice(-5).map(m => m.content || '');
  const bodySample = [query, ...historyMessages].join(' ').slice(0, 1500);

  // Step 5+6: Run The Matcher — always force Haiku (short queries score
  // artificially high on keyword normalization, must not skip Haiku)
  let matchResult;
  try {
    matchResult = await runMatch({
      url: 'chat://' + pubId,
      title: query,
      metaDescription: '',
      firstParagraph: query,
      bodySample,
      pubId,
      forceHaiku: true,  // chat path always needs Haiku classification
    });
  } catch (e) {
    console.error('/chat/query match error:', e.message);
    return res.status(200).json({ bid: null, reason: 'match_error' });
  }

  if (!matchResult.winner) {
    // Store unmatched query for publisher gap analysis
    if (storeQuery !== false && matchResult.category) {
      const today = new Date().toISOString().slice(0, 10);
      kvListPush('conv_unmatched:' + pubId + ':' + today, {
        query, category: matchResult.category, time: new Date().toISOString()
      }, 500).catch(() => {});
    }
    return res.status(200).json({ bid: null, reason: matchResult.reason || 'no_relevant_campaign' });
  }

  const winner = matchResult.winner;
  const selectedVariant = matchResult.selectedVariant;

  // Step 7: History relevance gate — check last 5 messages score the winning campaign
  if (historyMessages.length > 0) {
    const historyText = historyMessages.join(' ');
    const historyScore = scoreCampaignRelevance(winner, {
      bodySample: historyText,
      title: query,
      metaDescription: '',
      firstParagraph: query,
    });
    if (historyScore < CONVERSATIONAL_GATE) {
      return res.status(200).json({ bid: null, reason: 'history_not_relevant' });
    }
  }

  // Step 8: Find a trackable URL for this campaign
  const tokens = (await kvGet('track:list:' + winner.id)) || [];
  let trackableUrl = null;
  let anchor = winner.advertiser;
  for (const token of tokens) {
    const link = await kvGet('track:' + token);
    if (link && link.active) {
      trackableUrl = PLATFORM_URL + '/t/' + token;
      break;
    }
  }

  // Step 9: Extract anchor from [[anchor|url]] syntax in variant text
  const variantText = (selectedVariant && selectedVariant.text) || '';
  const inlineLinkMatch = variantText.match(/\[\[([^\]|]+)\|([^\]]+)\]\]/);
  if (inlineLinkMatch) {
    anchor = inlineLinkMatch[1];
    if (!trackableUrl) trackableUrl = inlineLinkMatch[2];
  }
  const textDisplay = variantText.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$1');

  // Step 10: Generate conversational bridge phrase via Haiku
  let bridge = 'Worth knowing:';
  if ((matchResult.relevanceScore || 0) >= 0.5) {
    try {
      const lastMsg = (history || []).slice(-1)[0];
      const lastContent = lastMsg ? lastMsg.content : '';
      const bridgeResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 30,
          messages: [{
            role: 'user',
            content: 'The user just asked: "' + query + '"\n' +
              (lastContent ? 'Last thing they said: "' + lastContent + '"\n' : '') +
              '\nWrite a single short phrase (max 8 words) that naturally introduces a sponsored message in this conversation. ' +
              'Match the user\'s register. Sound like a knowledgeable friend. ' +
              'NEVER mention the brand. NEVER make a product claim. Just bridge. ' +
              'Examples: "Worth knowing here:", "That\'s actually relevant —", "Good timing on that —", "One thing to consider:" ' +
              '\nRespond with ONLY the bridge phrase. Nothing else.',
          }],
        }),
      });
      if (bridgeResp.ok) {
        const bd = await bridgeResp.json();
        const raw = ((bd.content || [])[0] || {}).text || '';
        if (raw.trim().length > 0 && raw.trim().length <= 60) bridge = raw.trim();
      }
    } catch (e) { /* bridge stays as fallback */ }
  }

  const bridgeWithText = bridge + ' ' + textDisplay;

  // Step 11: Log query for Track 3 (Query Insights)
  if (storeQuery !== false) {
    const today = new Date().toISOString().slice(0, 10);
    kvListPush('conv_queries:' + winner.id + ':' + today, {
      query, pubId, time: new Date().toISOString(), matched: true,
    }, 500).catch(() => {});
  }

  // Step 12: Update frequency state
  kvSetWithTTL(lastAdKey, turns, 86400).catch(() => {});

  // Step 13: Return bid
  return res.status(200).json({
    bid: {
      campaignId: winner.id,
      variantId: (selectedVariant && selectedVariant.id) || null,
      advertiser: winner.advertiser,
      text: variantText,
      textDisplay,
      bridge,
      bridgeWithText,
      sponsored: true,
      sponsoredLabel: 'Sponsored',
      trackableUrl,
      anchor,
      category: matchResult.category,
      relevanceScore: matchResult.relevanceScore || null,
    },
  });
}

// ── /match handler (Surface A — unchanged) ─────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pub-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const body = await readBody(req);
  if (!body) return res.status(400).json({ error: 'Invalid JSON body' });

  // ── Route: /chat/query ────────────────────────────────────────
  if (req.query && req.query._route === 'chat') {
    return handleChatQuery(req, res, body);
  }

  // ── Route: /match (Surface A) ────────────────────────────────
  if (!body.url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    // Resolve pubId from token auth or body
    const resolvedPubId = await resolvePubId(body, req);

    const result = await runMatch({
      url: body.url,
      title: body.title || '',
      metaDescription: body.metaDescription || '',
      firstParagraph: body.firstParagraph || '',
      bodySample: body.bodySample || body.firstParagraph || '',
      publisherCategory: body.publisherCategory || null,
    });
    // Session 8: include pubId from demo-pages lookup so the Worker
    // can pass it through to /impression for per-publisher tracking.
    // Session 9: prefer token-resolved pubId over demo-pages lookup.
    const urlPath = new URL(body.url, 'https://x').pathname;
    result.pubId = resolvedPubId || getPubId(urlPath) || null;
    return res.status(200).json(result);
  } catch (e) {
    console.error('/match error:', e.message);
    return res.status(200).json({
      winner: null,
      category: null,
      reason: 'match_error',
      error: e.message,
    });
  }
};
