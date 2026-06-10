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

const { kvGet, kvIncr } = require('./kv');

const TRAINING_BILL_RATIO = 0.3;

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
  const [dr, dt, tr, tt] = await Promise.all([
    kvGet(imprKey('retrieval', campaign.id, today)),
    kvGet(imprKey('training', campaign.id, today)),
    kvGet(imprKey('retrieval', campaign.id, 'total')),
    kvGet(imprKey('training', campaign.id, 'total')),
  ]);
  const n = v => parseInt(v) || 0;
  return {
    dailySpendGBP: computeSpendGBP(campaign, n(dr), n(dt)),
    totalSpendGBP: computeSpendGBP(campaign, n(tr), n(tt)),
    dailyImpressions: n(dr) + n(dt),
    totalImpressions: n(tr) + n(tt),
    // Retrieval = "viewable" (reached a live retrieval crawler, real answer-influence potential)
    // Training = speculative future influence, not viewable
    retrievalTotal: n(tr),
    trainingTotal: n(tt),
    retrievalToday: n(dr),
    trainingToday: n(dt),
  };
}

// Is this campaign currently eligible to serve at all?
// (active flag + date window — budget is checked separately)
function isEligible(campaign, today) {
  if (!campaign || campaign.active !== true) return false;
  if (campaign.startDate && campaign.startDate > today) return false;
  if (campaign.endDate && campaign.endDate < today) return false;
  if (!campaign.text) return false;
  return true;
}

// ============================================================
// runAuction(category) → winning campaign object or null
// ============================================================
async function runAuction(category) {
  try {
    const today = todayStr();

    // 1. Get campaign IDs for this category
    const ids = await kvGet(`campaigns:${category}`);
    if (!ids || !Array.isArray(ids) || ids.length === 0) return null;

    // 2. Fetch all campaign objects in parallel
    const campaigns = (await Promise.all(
      ids.map(id => kvGet(`campaign:${id}`))
    )).filter(c => isEligible(c, today));

    if (campaigns.length === 0) return null;

    // 3. Shuffle (fair tiebreak), then stable-sort by CPM descending.
    //    Array.prototype.sort is stable in Node 12+, so equal-CPM
    //    campaigns keep their shuffled (random) relative order.
    const sorted = shuffle(campaigns).sort((a, b) => (b.cpmGBP || 0) - (a.cpmGBP || 0));

    // 4. Walk the waterfall: first campaign with budget headroom wins
    for (const campaign of sorted) {
      const spend = await getCampaignSpend(campaign);
      const dailyOk = !campaign.budgetDailyGBP || spend.dailySpendGBP < campaign.budgetDailyGBP;
      const totalOk = !campaign.budgetTotalGBP || spend.totalSpendGBP < campaign.budgetTotalGBP;
      if (dailyOk && totalOk) {
        return campaign;
      }
    }

    // 5. Everyone is over budget — serve nothing
    return null;

  } catch (e) {
    console.error('Auction error:', e.message);
    return null; // Never break the page because of an auction failure
  }
}

// ============================================================
// recordImpression(campaign, crawlerType)
// Increments the winner's atomic impression counters.
// crawlerType: 'retrieval' | 'training' | anything else → treated
// as 'retrieval' for billing (conservative: unknown bots that
// passed detection are most likely live retrieval fetches).
// ============================================================
async function recordImpression(campaign, crawlerType) {
  try {
    const type = crawlerType === 'training' ? 'training' : 'retrieval';
    const today = todayStr();
    await Promise.all([
      kvIncr(imprKey(type, campaign.id, today)),
      kvIncr(imprKey(type, campaign.id, 'total')),
    ]);
  } catch (e) {
    console.error('recordImpression error:', e.message);
  }
}

module.exports = {
  runAuction,
  recordImpression,
  getCampaignSpend,
  isEligible,
  TRAINING_BILL_RATIO,
};
