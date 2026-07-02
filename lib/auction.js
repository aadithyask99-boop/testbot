// ============================================================
// AUCTION ENGINE — First-price CPM waterfall
// ============================================================
// Plain English: Given a category (finance/tech), find all
// active campaigns, sort them by CPM (highest first), and
// pick the first one that still has budget left today and
// overall. Ties at the same CPM are shuffled so neither
// campaign starves (fair round-robin via randomness).
//
// This is a lib file — it does NOT count against the Vercel
// 12-function limit. index.js requires it directly. Never
// call this over HTTP from our own deployment.
//
// SPEND MODEL (decided 2026-06-10):
// We do not store spend in pounds. We store impression COUNTS
// per campaign per day (retrieval and training separately)
// and compute spend on read:
//   spend = (retrievalImpr * cpmGBP + trainingImpr * cpmGBP * 0.3) / 1000
// Training impressions are billed at 30% of campaign CPM.
// Counters are atomic (Redis INCR) so there is no race
// condition. A concurrent burst can overshoot a budget by a
// few impressions (~pennies) — accepted, not worth fixing.
// ============================================================

const { kvGet, kvIncr, kvIncrBy } = require('./kv');

const TRAINING_BILL_RATIO = 0.3;
const PUBLISHER_SHARE     = 0.8;
const PLATFORM_SHARE      = 0.2;

// KV key helpers — single source of truth for key names
function imprKey(type, campaignId, date) {
  // type: 'retrieval' | 'training'
  // date: 'YYYY-MM-DD' for daily, or 'total' for all-time
  return `impr:${type}:${campaignId}:${date}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Fisher-Yates shuffle. Used BEFORE the stable sort so that
// campaigns tied on CPM end up in random order (fair rotation).
// Never use Math.random inside a sort comparator — that's an
// inconsistent comparator and gives biased/undefined ordering.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Compute a campaign's spend in GBP from its impression counters
function computeSpendGBP(campaign, retrievalImpr, trainingImpr) {
  const cpm = campaign.cpmGBP || 0;
  return ((retrievalImpr * cpm) + (trainingImpr * cpm * TRAINING_BILL_RATIO)) / 1000;
}

// Fetch daily + total spend for one campaign
async function getCampaignSpend(campaign) {
  const today = todayStr();
  const [dr, dt, tr, tt, cr, ct] = await Promise.all([
    kvGet(imprKey('retrieval', campaign.id, today)),
    kvGet(imprKey('training', campaign.id, today)),
    kvGet(imprKey('retrieval', campaign.id, 'total')),
    kvGet(imprKey('training', campaign.id, 'total')),
    kvGet('impr:conversational:' + campaign.id + ':' + today),
    kvGet('impr:conversational:' + campaign.id + ':total'),
  ]);
  const n = v => parseInt(v) || 0;
  const cpm = campaign.cpmGBP || 0;
  // Conversational billed at retrieval rate (not 0.3x training)
  const convDailySpend = (n(cr) * cpm) / 1000;
  const convTotalSpend = (n(ct) * cpm) / 1000;
  return {
    dailySpendGBP: computeSpendGBP(campaign, n(dr), n(dt)) + convDailySpend,
    totalSpendGBP: computeSpendGBP(campaign, n(tr), n(tt)) + convTotalSpend,
    dailyImpressions: n(dr) + n(dt),
    totalImpressions: n(tr) + n(tt),
    retrievalTotal: n(tr),
    trainingTotal: n(tt),
    retrievalToday: n(dr),
    trainingToday: n(dt),
    conversationalTotal: n(ct),
    conversationalToday: n(cr),
  };
}

// Is this campaign currently eligible to serve at all?
// (active flag + date window — budget is checked separately)
// Session 5: `text` field removed — eligibility now requires a
// non-empty `variants[]`. Variant selection happens later
// (lib/relevance.js, after this campaign wins the auction).
function isEligible(campaign, today) {
  if (!campaign || campaign.active !== true) return false;
  if (campaign.startDate && campaign.startDate > today) return false;
  if (campaign.endDate && campaign.endDate < today) return false;
  if (!Array.isArray(campaign.variants) || campaign.variants.length === 0) return false;
  return true;
}

// ============================================================
// runAuction(category) → winning campaign object or null
// ============================================================
// ============================================================
// runAuctionFromList(campaigns) → winning campaign or null
// ============================================================
// Same shuffle → stable-sort → walk-budgets logic as runAuction,
// but takes a pre-filtered list with relevanceScore attached.
//
// WEIGHTED RELEVANCE (Session 10):
// Sort by effectiveCPM = cpmGBP × relevanceScore (Google Ad Rank model).
// This means a campaign with rel 0.53 at £10 bids £5.30 effective,
// losing to rel 0.91 at £10 bidding £9.10 — higher relevance wins
// at equal stated CPM. Resolves Freetrade (rel 0.53) beating HL
// (rel 0.91) on a random shuffle when CPMs are tied.
//
// If relevanceScore is missing (campaign didn't go through Haiku),
// falls back to stated cpmGBP (safe default, no regression).
// ============================================================
async function runAuctionFromList(campaigns) {
  if (!Array.isArray(campaigns) || campaigns.length === 0) return null;
  const today = todayStr();

  const eligible = campaigns.filter(c => isEligible(c, today));
  if (eligible.length === 0) return null;

  // Attach effectiveCPM before sort — relevanceScore may be 0..1 or absent
  const withEffective = eligible.map(c => ({
    ...c,
    _effectiveCPM: (c.cpmGBP || 0) * (c.relevanceScore != null ? c.relevanceScore : 1.0),
  }));

  // Shuffle for fair tiebreak at equal effectiveCPM, then sort descending
  const sorted = shuffle(withEffective).sort((a, b) => b._effectiveCPM - a._effectiveCPM);

  for (const campaign of sorted) {
    const spend = await getCampaignSpend(campaign);
    const dailyOk = !campaign.budgetDailyGBP || spend.dailySpendGBP < campaign.budgetDailyGBP;
    const totalOk = !campaign.budgetTotalGBP || spend.totalSpendGBP < campaign.budgetTotalGBP;
    if (dailyOk && totalOk) {
      return campaign;
    }
  }

  return null;
}

// ============================================================
// runAuction(category) → winning campaign object or null
// ============================================================
// Original CPM-only auction. Used by api/index.js BEFORE matching
// is wired in. After Session 3 matching layer, api/index.js calls
// runMatch() which calls runAuctionFromList() with the
// relevance-filtered list. This function stays for backwards
// compatibility and tests.
// ============================================================
async function runAuction(category) {
  try {
    // 1. Get campaign IDs for this category
    const ids = await kvGet(`campaigns:${category}`);
    if (!ids || !Array.isArray(ids) || ids.length === 0) return null;

    // 2. Fetch all campaign objects in parallel
    const campaigns = await Promise.all(ids.map(id => kvGet(`campaign:${id}`)));

    // 3. Delegate to the shared walk logic
    return runAuctionFromList(campaigns);

  } catch (e) {
    console.error('Auction error:', e.message);
    return null; // Never break the page because of an auction failure
  }
}

// ============================================================
// recordImpression(campaign, crawlerType, pubId?)
// Increments the winner's atomic impression counters AND
// records revenue in pence (integer, atomic) for all three
// parties: advertiser billed, publisher earned, platform kept.
//
// Revenue stored as INTEGER PENCE (multiply £ by 100).
// e.g. £0.096 → 10 pence (rounded). On read: divide by 100.
//
// KV keys written:
//   impr:retrieval|training:{campaignId}:{date|total}  ← existing
//   revenue:gross:total                                 ← new (pence)
//   revenue:gross:date:{date}                           ← new (pence)
//   revenue:publisher:{pubId}:total                     ← new (pence)
//   revenue:publisher:{pubId}:date:{date}               ← new (pence)
//   revenue:advertiser:{advId}:total                    ← new (pence)
//   revenue:advertiser:{advId}:date:{date}              ← new (pence)
//   revenue:platform:total                              ← new (pence)
//   revenue:platform:date:{date}                        ← new (pence)
// ============================================================
async function recordImpression(campaign, crawlerType, pubId) {
  try {
    const type  = crawlerType === 'training' ? 'training' : 'retrieval';
    const today = todayStr();
    const ratio = type === 'training' ? TRAINING_BILL_RATIO : 1.0;

    // Impression counts (existing — do not change)
    await Promise.all([
      kvIncr(imprKey(type, campaign.id, today)),
      kvIncr(imprKey(type, campaign.id, 'total')),
    ]);

    // Revenue in tenths-of-pence (atomic integer, × 1000 so sub-penny amounts survive rounding)
    const grossGBP     = (campaign.cpmGBP * ratio) / 1000;
    const pubGBP       = grossGBP * PUBLISHER_SHARE;
    const platformGBP  = grossGBP * PLATFORM_SHARE;
    const grossT       = Math.round(grossGBP    * 1000);  // tenths-of-pence
    const pubT         = Math.round(pubGBP      * 1000);
    const platformT    = Math.round(platformGBP * 1000);

    const revenueOps = [
      kvIncrBy('revenue:gross:total',              grossT),
      kvIncrBy(`revenue:gross:date:${today}`,      grossT),
      kvIncrBy('revenue:platform:total',           platformT),
      kvIncrBy(`revenue:platform:date:${today}`,   platformT),
    ];

    const advKey = campaign.advId || campaign.id;
    revenueOps.push(kvIncrBy(`revenue:advertiser:${advKey}:total`,         grossT));
    revenueOps.push(kvIncrBy(`revenue:advertiser:${advKey}:date:${today}`, grossT));

    if (pubId) {
      revenueOps.push(kvIncrBy(`revenue:publisher:${pubId}:total`,         pubT));
      revenueOps.push(kvIncrBy(`revenue:publisher:${pubId}:date:${today}`, pubT));
    }

    await Promise.all(revenueOps);
  } catch (e) {
    console.error('recordImpression error:', e.message);
  }
}

module.exports = {
  runAuction,
  runAuctionFromList,
  recordImpression,
  getCampaignSpend,
  isEligible,
  TRAINING_BILL_RATIO,
};

// redeploy 17:11:00
