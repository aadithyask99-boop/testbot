// ============================================================
// ADMIN ENDPOINT — Campaign management (Session 2)
// GET  /admin                  — list all campaigns + spend status
// POST /admin/campaign         — create or update a campaign
// POST /admin/campaign/pause   — pause/unpause: { id, active }
// POST /admin/seed             — seed default campaign from config
// GET  /ad?cat=CATEGORY        — auction winner for a category (SDK)
//
// NOTE: campaigns:{category} index lists use read-modify-write.
// Admin operations are low-concurrency (a human clicking a form)
// so this is safe. NEVER use this pattern for counters.
// ============================================================

const config = require('../lib/config');
const { kvGet, kvSet, kvDel } = require('../lib/kv');
const { runAuction, getCampaignSpend } = require('../lib/auction');

// ============================================================
// CRAWL INFRASTRUCTURE (Session 10)
// When variants change, we fire synthetic bot crawls so Haiku
// re-selects variants with the updated bank before real AI visits.
// Crawls hit the Cloudflare Worker URLs (not raw publisher URLs)
// so the full injection + impression + caching pipeline runs.
//
// Worker URL convention: the Worker domain is the second entry
// in publisher.domains[] (index 1). Pages are discovered from
// config.publisherPages (keyed by pubId → array of paths).
// ============================================================
const CRAWL_BOT_UA = 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)';

// Known article paths per publisher — used for crawl targeting
const PUBLISHER_PAGES = {
  pub_001: [
    '/articles/best-isa-2026.html',
    '/articles/pension-vs-isa.html',
    '/articles/dividend-investing.html',
    '/articles/first-time-buyer.html',
  ],
  pub_002: [
    '/articles/best-vpn-2026.html',
    '/articles/best-antivirus.html',
    '/articles/best-broadband.html',
    '/articles/cloud-storage.html',
  ],
};

// Category → which publishers carry it
const CATEGORY_PUBLISHERS = {
  finance: ['pub_001'],
  tech:    ['pub_002'],
};

// Get Worker base URL for a publisher (second domain entry)
function getWorkerUrl(pubId) {
  const pub = (config.publishers || []).find(p => p.pubId === pubId);
  if (!pub || !pub.domains || pub.domains.length < 2) return null;
  return 'https://' + pub.domains[1];
}

// Fire synthetic bot crawls for all pages in a category.
// Returns immediately — crawls happen in the background.
// delayMs: wait before firing (lets admin make further edits first).
function scheduleCrawls(category, delayMs) {
  const pubIds = CATEGORY_PUBLISHERS[category] || [];
  setTimeout(async () => {
    const crawlOps = [];
    for (const pubId of pubIds) {
      const workerUrl = getWorkerUrl(pubId);
      if (!workerUrl) continue;
      const paths = PUBLISHER_PAGES[pubId] || [];
      for (const path of paths) {
        const url = workerUrl + path;
        crawlOps.push(
          fetch(url, {
            headers: { 'User-Agent': CRAWL_BOT_UA },
            signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
          })
          .then(() => console.log(`[auto-crawl] ${url}`))
          .catch(e => console.error(`[auto-crawl] failed ${url}: ${e.message}`))
        );
      }
    }
    await Promise.all(crawlOps);
    console.log(`[auto-crawl] ${category} complete — ${crawlOps.length} pages crawled`);
  }, delayMs);
}

// Detect if variants changed between old and new campaign.
// True if: new campaign (no existing), variant count changed,
// or any variant text/angle differs.
function variantsChanged(existingCampaign, newVariants) {
  if (!existingCampaign) return true; // new campaign
  const old = existingCampaign.variants || [];
  if (old.length !== newVariants.length) return true;
  for (let i = 0; i < old.length; i++) {
    if (old[i].text !== newVariants[i].text) return true;
    if (old[i].angle !== newVariants[i].angle) return true;
  }
  return false;
}

// ============================================================
// AI RECOMMENDATIONS (Session 10 Batch 6)
// Haiku evaluates a campaign's FULL variant set (promo + data-led,
// no manual tagging required) against real page content, and
// proposes 2-3 candidates it believes are most likely to be
// surfaced/cited by AI crawlers. Nothing goes live without the
// advertiser approving — see KV schema below.
//
// KV keys:
//   recommendations:{campaignId}:{pageUrlHash}  → { suggestions: [...], generatedAt }
//   approved:{campaignId}                        → [{ variantId, pageUrlHash, approvedAt }]
// Once a campaign has ANY approved entry, runAuction's variant
// selection (lib/relevance.js) should prefer approved-only —
// that gating logic lives in lib/relevance.js, not here.
// ============================================================
const crypto = require('crypto');

function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

// Fetch a page and extract a plain-text sample (strip tags, first ~800 chars
// of the main content). Best-effort — used only for recommendation context,
// not for production matching, so a rough extraction is fine.
async function fetchPageSample(pageUrl) {
  try {
    const resp = await fetch(pageUrl, {
      headers: { 'User-Agent': CRAWL_BOT_UA },
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      title: titleMatch ? titleMatch[1].trim() : '',
      metaDescription: metaMatch ? metaMatch[1].trim() : '',
      bodySample: text.slice(0, 800),
    };
  } catch (e) {
    console.error('fetchPageSample failed:', pageUrl, e.message);
    return null;
  }
}

// Ask Haiku to evaluate the FULL variant set (no pre-tagging) against
// real page content and propose 2-3 recommended candidates. Each
// recommendation references an existing variant id OR proposes a
// rewrite (new text) — Haiku decides which based on what's already there.
async function haikuRecommendVariants(campaign, pageUrl, pageSample) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY missing — recommendations skipped');
    return null;
  }
  const variants = campaign.variants || [];
  if (variants.length === 0) return null;

  const variantLines = variants.map(v =>
    `${v.id} (${v.angle}): "${(v.text || '').replace(/\s+/g, ' ').trim()}"`
  ).join('\n');

  const prompt = `You are advising an advertiser on which ad variants are most likely to be surfaced or cited by AI systems (Perplexity, ChatGPT Browse, Gemini) when they crawl this specific page.

Page title: ${pageSample.title || '(none)'}
Page description: ${pageSample.metaDescription || '(none)'}
Page content sample: ${pageSample.bodySample || '(none)'}

Advertiser: ${campaign.advertiser}
All current ad variants for this advertiser:
${variantLines}

Task: Recommend 2-3 variants (by id) that are most likely to be absorbed as editorial fact rather than flagged as a promotional/advertising section by AI content pipelines. AI systems tend to favour content with specific statistics, named authoritative sources, and a neutral informational tone — and tend to flag content with brand-as-subject calls-to-action ("Open a...", "Try...") and disclaimer language as promotional.

If NONE of the existing variants are strong fits for this page, you may propose ONE rewritten variant instead — same core message, rewritten to read as an attributed fact (e.g. "According to [Brand]'s data...") rather than a sales pitch. Only do this if existing variants are clearly weak; prefer recommending existing variants when they're good.

Respond with ONLY valid JSON, no markdown, no explanation:
{"recommendations":[{"variantId":"v3","reason":"one sentence why"},{"variantId":"v5","reason":"one sentence why"}]}
For a proposed rewrite instead of an existing variant id, use "variantId":"new" and include "proposedText" and "proposedAngle".`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      console.error('Haiku recommendation call failed:', resp.status);
      return null;
    }
    const data = await resp.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.recommendations || null;
  } catch (e) {
    console.error('haikuRecommendVariants error:', e.message);
    return null;
  }
}

async function readBody(req) {
  let body = '';
  await new Promise(resolve => { req.on('data', c => body += c); req.on('end', resolve); });
  try { return JSON.parse(body); } catch { return null; }
}

// Session 6: after a campaign is created/edited/paused/deleted, the
// relevance-filter and variant caches for that campaign across every
// known page may now be stale (candidate set changed, or the campaign's
// own data — matchingDescription/variants/cpmGBP — changed). Fire an
// internal call to /precompute?action=invalidate to clear those specific
// cache entries. Best-effort: a failure here is non-fatal — the caches
// would otherwise just expire naturally at their 24h TTL, so this is an
// optimization for faster propagation, not a correctness requirement.
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://testbot-two-psi.vercel.app';
async function invalidatePrecomputeCaches(campaignId, category) {
  try {
    await fetch(`${PLATFORM_URL}/precompute?action=invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, category: category || null }),
    });
  } catch (e) {
    console.error('Precompute invalidate call failed (non-fatal):', e.message);
  }
}

// Add a campaign ID to its category index list (idempotent)
async function addToCategoryIndex(category, id) {
  const ids = (await kvGet(`campaigns:${category}`)) || [];
  if (!ids.includes(id)) {
    ids.push(id);
    await kvSet(`campaigns:${category}`, ids);
  }
}

// Validate a variants array against config.variantLimits.
// Throws with a human-readable message on failure — caller returns 400.
function validateVariants(variants) {
  const { min, max, maxTextLength } = config.variantLimits;
  if (!Array.isArray(variants)) {
    throw new Error('variants must be an array');
  }
  if (variants.length < min || variants.length > max) {
    throw new Error(`variants must contain between ${min} and ${max} entries (got ${variants.length})`);
  }
  const seenAngles = new Set();
  let duplicateAngle = null;
  variants.forEach((v, i) => {
    if (!v || typeof v !== 'object') {
      throw new Error(`variant ${i + 1} is invalid`);
    }
    if (!v.text || typeof v.text !== 'string' || !v.text.trim()) {
      throw new Error(`variant ${i + 1} is missing text`);
    }
    if (v.text.length > maxTextLength) {
      throw new Error(`variant ${i + 1} text exceeds ${maxTextLength} characters (got ${v.text.length})`);
    }
    if (!v.angle || typeof v.angle !== 'string' || !v.angle.trim()) {
      throw new Error(`variant ${i + 1} is missing angle`);
    }
    const angleKey = v.angle.trim().toLowerCase();
    if (seenAngles.has(angleKey) && !duplicateAngle) duplicateAngle = v.angle;
    seenAngles.add(angleKey);
  });
  return { duplicateAngleWarning: duplicateAngle };
}

// Assign stable v1..vN ids in order. Existing ids are discarded and
// reassigned — simple and stable at this scale (max 15 variants).
function normalizeVariants(variants) {
  return variants.map((v, i) => ({
    id: 'v' + (i + 1),
    angle: v.angle.trim(),
    text: v.text.trim(),
  }));
}

async function saveCampaign(data) {
  const validation = validateVariants(data.variants);
  const campaign = {
    id: data.id,
    advId: data.advId || null,
    advertiser: data.advertiser || 'Unknown',
    category: data.category,
    cpmGBP: parseFloat(data.cpmGBP) || 10,
    budgetDailyGBP: parseFloat(data.budgetDailyGBP) || 0,
    budgetTotalGBP: parseFloat(data.budgetTotalGBP) || 0,
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    matchingDescription: data.matchingDescription || '',
    variants: normalizeVariants(data.variants),
    link: data.link || '',
    linkText: data.linkText || 'Learn more',
    advSlug: data.advSlug || (data.advertiser || 'unknown').toLowerCase().replace(/\s+/g, '-'),
    active: data.active !== false,
    startDate: data.startDate || new Date().toISOString().split('T')[0],
    endDate: data.endDate || null,
    updatedAt: new Date().toISOString(),
  };
  await kvSet(`campaign:${campaign.id}`, campaign);
  await addToCategoryIndex(campaign.category, campaign.id);
  return { campaign, duplicateAngleWarning: validation.duplicateAngleWarning };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';


  // ---- RESET STATS (destructive: zeroes counters + logs, keeps campaigns) ----
  if (req.method === 'POST' && url.includes('/admin/reset-stats')) {
    const today = new Date().toISOString().split('T')[0];
    // Delete known counter + log keys. Campaign objects and category
    // indexes are NOT touched. Per-campaign impression counters are
    // cleared for all known campaigns so spend resets to zero too.
    const keys = [
      'stats:impressions:total', `stats:impressions:date:${today}`,
      'stats:impressions:type:retrieval', 'stats:impressions:type:training',
      'stats:impr_by_platform', 'stats:platform_totals',
      'stats:clicks:total', `stats:clicks:date:${today}`, 'stats:click_by_platform',
      'stats:unique_clicks:total', `stats:unique_clicks:date:${today}`, 'stats:uniq_click_by_platform',
      'stats:adclicks:total', `stats:adclicks:date:${today}`,
      'log:recent', 'log:clicks', 'log:adclicks',
    ];
    // Add per-campaign impression counters for every campaign
    for (const cat of config.categories) {
      const ids = (await kvGet(`campaigns:${cat}`)) || [];
      for (const id of ids) {
        keys.push(`impr:retrieval:${id}:total`, `impr:training:${id}:total`,
                  `impr:retrieval:${id}:${today}`, `impr:training:${id}:${today}`);
      }
    }
    // Add per-publisher impression counters
    for (const pub of (config.publishers || [])) {
      keys.push(
        `stats:impressions:pub:${pub.pubId}:total`,
        `stats:impressions:pub:${pub.pubId}:date:${today}`,
        `stats:impr_by_pub_plat:${pub.pubId}`,
      );
    }
    await Promise.all(keys.map(k => kvDel(k)));
    return res.status(200).json({ message: 'Stats reset', clearedKeys: keys.length });
  }

  // ---- RESET STATS (destructive: wipes impression/click counters) ----
  // Does NOT touch campaigns. Clears all stats counters, per-campaign
  // impression counters, platform hashes, and logs — for a clean baseline.
  if (req.method === 'POST' && url.includes('/admin/reset-stats')) {
    // Gather per-campaign impression keys to delete
    const campaignKeys = [];
    for (const cat of config.categories) {
      const ids = (await kvGet('campaigns:' + cat)) || [];
      for (const id of ids) {
        // delete a window of recent daily keys + totals
        campaignKeys.push('impr:retrieval:' + id + ':total', 'impr:training:' + id + ':total', 'stats:impr_by_camp_plat:' + id);
        for (let d = 0; d < 14; d++) {
          const day = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
          campaignKeys.push('impr:retrieval:' + id + ':' + day, 'impr:training:' + id + ':' + day);
        }
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const statKeys = [
      'stats:impressions:total', 'stats:impressions:date:' + today,
      'stats:impressions:type:retrieval', 'stats:impressions:type:training',
      'stats:clicks:total', 'stats:clicks:date:' + today,
      'stats:unique_clicks:total', 'stats:unique_clicks:date:' + today,
      'stats:adclicks:total', 'stats:adclicks:date:' + today,
      'stats:impr_by_platform', 'stats:click_by_platform',
      'stats:uniq_click_by_platform', 'log:recent', 'log:clicks', 'log:adclicks',
      'stats:bot_visits:total', 'stats:bot_served:total',
    ];

    // Per-publisher impression counters (Session 8)
    for (const pub of (config.publishers || [])) {
      statKeys.push(
        `stats:impressions:pub:${pub.pubId}:total`,
        `stats:impressions:pub:${pub.pubId}:date:${today}`,
        `stats:impr_by_pub_plat:${pub.pubId}`,
      );
    }

    const allKeys = [...new Set([...statKeys, ...campaignKeys])];
    await Promise.all(allKeys.map(k => kvDel(k)));
    return res.status(200).json({
      message: 'Stats reset. Campaigns preserved.',
      keysCleared: allKeys.length,
      note: 'Impression counters, click counters, platform breakdowns, and logs cleared.',
    });
  }

  // ---- REINDEX campaigns:finance + campaigns:tech from existing campaign:{id} keys ----
  // Useful after reset-stats clears category indexes. Safe to call any time.
  if (req.method === 'POST' && url.includes('/admin/reindex')) {
    try {
      // Known campaign IDs — scan all camp_001 through camp_020
      const allIds = [];
      for (let i = 1; i <= 20; i++) {
        allIds.push('camp_' + String(i).padStart(3, '0'));
      }
      const financeIds = [];
      const techIds = [];
      let found = 0;
      for (const id of allIds) {
        const camp = await kvGet('campaign:' + id);
        if (!camp || !camp.id || !camp.category) continue;
        found++;
        if (camp.category === 'finance') financeIds.push(camp.id);
        else if (camp.category === 'tech') techIds.push(camp.id);
      }
      await kvSet('campaigns:finance', financeIds);
      await kvSet('campaigns:tech', techIds);
      return res.status(200).json({
        message: 'Reindex complete',
        found,
        finance: financeIds,
        tech: techIds,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Reindex failed: ' + e.message });
    }
  }
  if (req.method === 'POST' && url.includes('/admin/seed')) {
    try {
      const { campaign } = await saveCampaign(config.defaultCampaign);
      // Seed publisher records (Session 8+9: now includes token + domains)
      const pubIds = [];
      for (const pub of (config.publishers || [])) {
        await kvSet(`publisher:${pub.pubId}`, {
          pubId: pub.pubId,
          name: pub.name,
          sitemapUrl: pub.sitemapUrl || null,
          domains: pub.domains || [],
          token: pub.token || null,
          floorCPM: pub.floorCPM || null,
          active: pub.active !== false,
          createdAt: new Date().toISOString(),
        });
        // Token → pubId reverse lookup (for fast auth in /match + /impression)
        if (pub.token) await kvSet(`pub_token:${pub.token}`, pub.pubId);
        pubIds.push(pub.pubId);
      }
      if (pubIds.length) await kvSet('publishers:all', pubIds);

      // Seed advertiser records (Session 9)
      const advIds = [];
      for (const adv of (config.advertisers || [])) {
        await kvSet(`advertiser:${adv.advId}`, {
          advId: adv.advId,
          name: adv.name,
          status: adv.status || 'active',
          createdAt: new Date().toISOString(),
        });
        advIds.push(adv.advId);
      }
      if (advIds.length) await kvSet('advertisers:all', advIds);

      return res.status(200).json({
        message: 'Seeded default campaign + publishers + advertisers',
        campaign,
        publishers: pubIds,
        advertisers: advIds,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Seed failed: ' + e.message });
    }
  }

  // ---- PAUSE / UNPAUSE ----
  if (req.method === 'POST' && url.includes('/admin/campaign/pause')) {
    const data = await readBody(req);
    if (!data || !data.id) return res.status(400).json({ error: 'id required' });
    const campaign = await kvGet(`campaign:${data.id}`);
    if (!campaign) return res.status(404).json({ error: 'campaign not found' });
    campaign.active = data.active === true;
    campaign.updatedAt = new Date().toISOString();
    await kvSet(`campaign:${campaign.id}`, campaign);
    await invalidatePrecomputeCaches(campaign.id, campaign.category);
    return res.status(200).json({ message: campaign.active ? 'Campaign activated' : 'Campaign paused', campaign });
  }

  // ---- DELETE campaign ----
  // Removes campaign:{id} AND removes from campaigns:{category} index.
  // POST /admin/campaign/delete  { id: 'camp_001' }
  if (req.method === 'POST' && url.includes('/admin/campaign/delete')) {
    const data = await readBody(req);
    if (!data || !data.id) return res.status(400).json({ error: 'id required' });
    const campaign = await kvGet(`campaign:${data.id}`);
    if (!campaign) return res.status(404).json({ error: 'campaign not found' });
    // Remove from campaign store
    await kvDel(`campaign:${data.id}`);
    // Remove from category index
    const ids = (await kvGet(`campaigns:${campaign.category}`)) || [];
    const updated = ids.filter(i => i !== data.id);
    await kvSet(`campaigns:${campaign.category}`, updated);
    await invalidatePrecomputeCaches(data.id, campaign.category);
    return res.status(200).json({ message: `Campaign deleted: ${data.id}`, id: data.id });
  }

  // ---- MANUAL CRAWL — trigger immediate crawl of all pages ----
  // POST /admin/crawl { category: 'finance'|'tech'|'all' }
  // Called by the dashboard "Crawl Now" button. Fires immediately (no delay).
  if (req.method === 'POST' && url.includes('/admin/crawl')) {
    const data = await readBody(req);
    const category = (data && data.category) || 'all';
    const categories = category === 'all' ? config.categories : [category];
    let totalPages = 0;
    for (const cat of categories) {
      const pubIds = CATEGORY_PUBLISHERS[cat] || [];
      for (const pubId of pubIds) {
        totalPages += (PUBLISHER_PAGES[pubId] || []).length;
      }
      scheduleCrawls(cat, 0); // immediate
    }
    return res.status(200).json({
      message: `Crawling ${totalPages} pages now`,
      categories,
      totalPages,
    });
  }

  // ---- GENERATE AI RECOMMENDATIONS ----
  // POST /admin/recommendations/generate { campaignId }
  // Fetches the campaign's live pages, calls Haiku once per page,
  // stores suggestions in KV. Read-only for the advertiser until approved.
  if (req.method === 'POST' && url.includes('/admin/recommendations/generate')) {
    const data = await readBody(req);
    const campaignId = data && data.campaignId;
    if (!campaignId) return res.status(400).json({ error: 'campaignId required' });
    const campaign = await kvGet(`campaign:${campaignId}`);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const pubIds = CATEGORY_PUBLISHERS[campaign.category] || [];
    const results = [];
    for (const pubId of pubIds) {
      const workerUrl = getWorkerUrl(pubId);
      if (!workerUrl) continue;
      const paths = PUBLISHER_PAGES[pubId] || [];
      for (const path of paths) {
        const pageUrl = workerUrl + path;
        const sample = await fetchPageSample(pageUrl);
        if (!sample) { results.push({ pageUrl, error: 'fetch failed' }); continue; }
        const recs = await haikuRecommendVariants(campaign, pageUrl, sample);
        if (!recs) { results.push({ pageUrl, error: 'haiku failed' }); continue; }
        const key = `recommendations:${campaignId}:${hashUrl(pageUrl)}`;
        const stored = { pageUrl, suggestions: recs, generatedAt: new Date().toISOString() };
        await kvSet(key, stored);
        results.push(stored);
      }
    }
    return res.status(200).json({ message: 'Recommendations generated', campaignId, results });
  }

  // ---- LIST AI RECOMMENDATIONS for a campaign ----
  // GET /admin/recommendations?campaignId=camp_002
  if (req.method === 'GET' && url.includes('/admin/recommendations') && !url.includes('generate')) {
    const campaignId = req.query && req.query.campaignId;
    if (!campaignId) return res.status(400).json({ error: 'campaignId required' });
    const campaign = await kvGet(`campaign:${campaignId}`);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const pubIds = CATEGORY_PUBLISHERS[campaign.category] || [];
    const items = [];
    for (const pubId of pubIds) {
      const workerUrl = getWorkerUrl(pubId);
      if (!workerUrl) continue;
      const paths = PUBLISHER_PAGES[pubId] || [];
      for (const path of paths) {
        const pageUrl = workerUrl + path;
        const key = `recommendations:${campaignId}:${hashUrl(pageUrl)}`;
        const stored = await kvGet(key);
        if (stored) items.push(stored);
      }
    }
    const approved = (await kvGet(`approved:${campaignId}`)) || [];
    return res.status(200).json({ campaignId, items, approved });
  }

  // ---- APPROVE / REJECT a recommendation ----
  // POST /admin/recommendations/decide
  // { campaignId, pageUrl, variantId, decision: 'approve'|'reject',
  //   proposedText?, proposedAngle? (only when variantId === 'new' and approved) }
  if (req.method === 'POST' && url.includes('/admin/recommendations/decide')) {
    const data = await readBody(req);
    const { campaignId, pageUrl, variantId, decision, proposedText, proposedAngle } = data || {};
    if (!campaignId || !pageUrl || !variantId || !decision) {
      return res.status(400).json({ error: 'campaignId, pageUrl, variantId, decision required' });
    }
    if (decision === 'reject') {
      // Rejection is scoped to this pairing only — no state change needed,
      // the recommendation stays in the stored list but the advertiser's
      // client-side UI marks it dismissed locally. Acknowledge only.
      return res.status(200).json({ message: 'Recommendation rejected (not stored as approved)' });
    }
    if (decision !== 'approve') return res.status(400).json({ error: 'decision must be approve or reject' });

    const campaign = await kvGet(`campaign:${campaignId}`);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    let finalVariantId = variantId;
    // If approving a proposed rewrite, add it to the campaign's variant bank first
    if (variantId === 'new') {
      if (!proposedText) return res.status(400).json({ error: 'proposedText required for new variant approval' });
      const nextNum = (campaign.variants || []).length + 1;
      finalVariantId = 'v' + nextNum;
      campaign.variants = [...(campaign.variants || []), {
        id: finalVariantId,
        angle: proposedAngle || 'AI-suggested rewrite',
        text: proposedText,
      }];
      campaign.updatedAt = new Date().toISOString();
      await kvSet(`campaign:${campaignId}`, campaign);
    }

    const approvedKey = `approved:${campaignId}`;
    const existing = (await kvGet(approvedKey)) || [];
    const already = existing.find(e => e.variantId === finalVariantId && e.pageUrl === pageUrl);
    if (!already) {
      existing.push({ variantId: finalVariantId, pageUrl, approvedAt: new Date().toISOString() });
      await kvSet(approvedKey, existing);
    }
    return res.status(200).json({ message: 'Recommendation approved', campaignId, variantId: finalVariantId, approved: existing });
  }

  // ---- CREATE / UPDATE campaign ----
  if (req.method === 'POST' && url.includes('/admin/campaign')) {
    const data = await readBody(req);
    if (!data) return res.status(400).json({ error: 'Invalid JSON' });
    const { id, category, variants } = data;
    if (!id || !category || !variants) {
      return res.status(400).json({ error: 'id, category and variants are required' });
    }
    if (!config.categories.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${config.categories.join(', ')}` });
    }
    try {
      // Check existing campaign before save to detect variant changes
      const existingCampaign = await kvGet(`campaign:${id}`);
      const { campaign, duplicateAngleWarning } = await saveCampaign(data);
      await invalidatePrecomputeCaches(campaign.id, campaign.category);

      // Auto-crawl if variants changed (new campaign or variant bank updated)
      // 60s delay so admin can make follow-up edits without firing multiple waves
      const changed = variantsChanged(existingCampaign, campaign.variants);
      if (changed) {
        console.log(`[auto-crawl] variants changed for ${campaign.id} — scheduling crawl in 60s`);
        scheduleCrawls(campaign.category, 60000);
      }

      const response = {
        message: `Campaign saved: ${campaign.id}`,
        campaign,
        autoCrawl: changed
          ? `Crawl scheduled in 60s — ${(CATEGORY_PUBLISHERS[campaign.category] || []).length > 0 ? PUBLISHER_PAGES[(CATEGORY_PUBLISHERS[campaign.category] || [])[0]]?.length || 0 : 0} pages will be re-crawled`
          : 'No variant changes — crawl not needed',
      };
      if (duplicateAngleWarning) {
        response.warning = `Duplicate variant angle detected: "${duplicateAngleWarning}". Distinct angles are recommended for variant selection to work well.`;
      }
      return res.status(200).json(response);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  // ---- GET /ad — auction winner for a category (used by SDK) ----
  // NOTE: was `url.startsWith('/ad')`, which also matches '/admin' —
  // '/admin'.startsWith('/ad') is true. Fixed to match only '/ad' itself
  // or '/ad?...' / '/ad/...'.
  if (req.method === 'GET' && /^\/ad(\?|\/|$)/.test(url)) {
    const category = (req.query && req.query.cat) || config.demoPageCategory;
    const winner = await runAuction(category);
    if (!winner) return res.status(200).json({ category, campaign: null, message: 'No eligible campaign' });
    return res.status(200).json({ category, campaign: winner });
  }

  // ---- GET /admin — list all campaigns with spend ----
  if (req.method === 'GET') {
    const allIds = [];
    for (const cat of config.categories) {
      const ids = (await kvGet(`campaigns:${cat}`)) || [];
      allIds.push(...ids);
    }
    const campaigns = [];
    for (const id of [...new Set(allIds)]) {
      const c = await kvGet(`campaign:${id}`);
      if (!c) continue;
      const spend = await getCampaignSpend(c);
      campaigns.push({ ...c, spend });
    }
    // Sort: active first, then CPM descending (auction order)
    campaigns.sort((a, b) => (b.active - a.active) || (b.cpmGBP - a.cpmGBP));
    return res.status(200).json({
      message: 'All campaigns',
      count: campaigns.length,
      campaigns,
      endpoints: {
        create: { method: 'POST', url: '/admin/campaign', body: { id: 'camp_002', advertiser: 'Brand', category: 'finance|tech', cpmGBP: 20, budgetDailyGBP: 50, budgetTotalGBP: 500, keywords: ['isa'], matchingDescription: '...', variants: [{ angle: 'first-home saver', text: 'Ad copy, max 200 chars' }, '...5-15 variants total'], link: '', linkText: '', advSlug: '', active: true, startDate: 'YYYY-MM-DD', endDate: null } },
        pause: { method: 'POST', url: '/admin/campaign/pause', body: { id: 'camp_002', active: false } },
        seed: { method: 'POST', url: '/admin/seed' },
      },
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
