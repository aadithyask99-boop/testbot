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

    const allKeys = [...new Set([...statKeys, ...campaignKeys])];
    await Promise.all(allKeys.map(k => kvDel(k)));
    return res.status(200).json({
      message: 'Stats reset. Campaigns preserved.',
      keysCleared: allKeys.length,
      note: 'Impression counters, click counters, platform breakdowns, and logs cleared.',
    });
  }

  // ---- SEED default campaign ----
  if (req.method === 'POST' && url.includes('/admin/seed')) {
    try {
      const { campaign } = await saveCampaign(config.defaultCampaign);
      return res.status(200).json({ message: 'Seeded default campaign', campaign });
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
      const { campaign, duplicateAngleWarning } = await saveCampaign(data);
      await invalidatePrecomputeCaches(campaign.id, campaign.category);
      const response = { message: `Campaign saved: ${campaign.id}`, campaign };
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
