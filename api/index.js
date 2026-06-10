const { analyseRequest } = require('../lib/combined-detector');
const { injectSponsoredContent } = require('../lib/injector');
const { detectAIReferrer } = require('../lib/referrer');
const { kvGet, kvSet, kvIncr, kvListPush, kvHashIncr } = require('../lib/kv');
const { runAuction, recordImpression } = require('../lib/auction');
const config = require('../lib/config');

const { getPage } = require('../lib/demo-pages');

module.exports = async function handler(req, res) {
  const detection = analyseRequest({
    headers: req.headers,
    // Rate signal removed from behavioural.js (Session 2) — no longer
    // need to pass requestsPerMinute. UA + anonymous_crawler detection
    // handle the cases that matter.
    meta: { visitCount: 1 }
  });

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  const ua = req.headers['user-agent'] || '';
  const referer = req.headers['referer'] || req.headers['referrer'] || '';
  const today = new Date().toISOString().split('T')[0];

  // --------------------------------------------------------
  // DEMO PAGE LOOKUP (Session 2): the path determines which
  // demo article serves AND which category enters the auction.
  // Unknown URLs return 404 so we don't accidentally inject on
  // the dashboard, /admin, /click, etc.
  //
  // TOMORROW (matching layer): replace the hardcoded
  // `page.category` below with a call to POST /match using
  // the page's title/meta/firstParagraph as input signals.
  // --------------------------------------------------------
  const page = getPage(req.url || '/');
  if (!page) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(404).send('<!doctype html><title>404</title><h1>404 — not a demo article</h1><p>Try: <a href="/articles/best-isa-2026">/articles/best-isa-2026</a></p>');
  }
  const ORIGINAL_PAGE = page.html;
  const pageCategory = page.category;


  console.log(JSON.stringify({
    time: new Date().toISOString(),
    ip, ua: ua.substring(0, 100),
    isBot: detection.isBot,
    platform: detection.platform,
    confidence: detection.confidence,
    crawlerType: detection.crawlerType,
    cpmMin: detection.suggestedCPM?.min,
    cpmMax: detection.suggestedCPM?.max,
    referer: referer.substring(0, 150),
  }));

  res.setHeader('Content-Type', 'text/html');

  // --------------------------------------------------------
  // BOT PATH — detected crawler, not a cloaking risk
  // Fetch live creative, inject, log impression
  // --------------------------------------------------------
  if (detection.isBot && !detection.cloakingRisk) {

    // --------------------------------------------------------
    // AUCTION: CPM waterfall picks the winning campaign for
    // THIS PAGE'S category (looked up per URL). No winner →
    // serve the CLEAN page, log the bot visit, bill nothing.
    //
    // TOMORROW: pageCategory comes from /match (a real
    // classification) instead of demo-pages.js (hardcoded).
    // --------------------------------------------------------
    const winner = await runAuction(pageCategory);

    if (!winner) {
      res.setHeader('X-Bot-Detected', 'true');
      res.setHeader('X-Bot-Platform', detection.platform || 'unknown');
      try {
        await Promise.all([
          kvIncr('stats:bot_visits:total'),   // fill-rate denominator
          kvListPush('log:recent', {
            time: new Date().toISOString(),
            ip,
            platform: detection.platform,
            crawlerType: detection.crawlerType,
            confidence: detection.confidence,
            served: 'none',
          }, 100),
        ]);
      } catch (e) {}
      return res.status(200).send(ORIGINAL_PAGE);
    }

    const sponsoredText = winner.text;
    const sponsoredLink = winner.link || '';
    const sponsoredLinkText = winner.linkText || 'Learn more';
    const advSlug = winner.advSlug || 'default';

    // Log impression — fire and forget, never breaks the page
    try {
      await Promise.all([
        recordImpression(winner, detection.crawlerType),
        kvIncr('stats:bot_visits:total'),   // fill-rate denominator
        kvIncr('stats:bot_served:total'),   // fill-rate numerator
        kvHashIncr('stats:impr_by_camp_plat:' + winner.id, detection.platform || 'unknown'),
        kvIncr('stats:impressions:total'),
        kvIncr(`stats:impressions:platform:${detection.platform || 'unknown'}`),
        kvIncr(`stats:impressions:type:${detection.crawlerType || 'unknown'}`),
        kvIncr(`stats:impressions:date:${today}`),
        kvHashIncr('stats:impr_by_platform', detection.platform || 'unknown'),
        kvListPush('log:recent', {
          time: new Date().toISOString(),
          ip,
          platform: detection.platform,
          crawlerType: detection.crawlerType,
          confidence: detection.confidence,
          campaignId: winner.id,
          advertiser: winner.advertiser,
          cpmGBP: winner.cpmGBP,
        }, 100),
      ]);
    } catch (e) {}

    const result = injectSponsoredContent(ORIGINAL_PAGE, sponsoredText, { strategy: 'auto', link: sponsoredLink, linkText: sponsoredLinkText, advSlug });
    res.setHeader('X-Bot-Detected', 'true');
    res.setHeader('X-Bot-Platform', detection.platform || 'unknown');
    res.status(200).send(result.html);

  // --------------------------------------------------------
  // HUMAN PATH — check for AI platform referrer (click tracking)
  // --------------------------------------------------------
  } else {

    const aiClick = detectAIReferrer(referer);

    if (aiClick) {
      try {
        // Check if this IP has clicked in the last 30 minutes (session dedup)
        const sessionKey = `session:click:${ip.split(',')[0].trim()}`;
        const sessionExists = await kvGet(sessionKey).catch(() => null);
        const isUnique = !sessionExists;

        const ops = [
          // Always count total clicks
          kvIncr('stats:clicks:total'),
          kvIncr(`stats:clicks:platform:${aiClick.platform}`),
          kvIncr(`stats:clicks:date:${today}`),
          kvHashIncr('stats:click_by_platform', aiClick.platform),
          kvListPush('log:clicks', {
            time: new Date().toISOString(),
            ip,
            platform: aiClick.platform,
            query: aiClick.query,
            referrer: aiClick.referrerUrl.substring(0, 200),
            unique: isUnique,
          }, 100),
        ];

        if (isUnique) {
          // Mark this IP as seen for 30 minutes (1800 seconds)
          ops.push(kvSet(sessionKey, '1', 300)); // 5-minute session window
          // Count unique clicks separately
          ops.push(kvIncr('stats:unique_clicks:total'));
          ops.push(kvIncr(`stats:unique_clicks:date:${today}`));
          ops.push(kvHashIncr('stats:uniq_click_by_platform', aiClick.platform));
        }

        await Promise.all(ops);
      } catch (e) {}
    }

    res.status(200).send(ORIGINAL_PAGE);
  }
};
