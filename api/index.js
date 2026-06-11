const { analyseRequest } = require('../lib/combined-detector');
const { injectSponsoredContent } = require('../lib/injector');
const { detectAIReferrer } = require('../lib/referrer');
const { kvGet, kvSet, kvIncr, kvListPush, kvHashIncr } = require('../lib/kv');
const { runAuction, recordImpression } = require('../lib/auction');
const { runMatch } = require('../lib/relevance');
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
    // MATCH + AUCTION (Session 3): the hybrid cascade.
    // runMatch() does: cache → publisher tag → keyword → Haiku
    // → per-campaign relevance filter → runAuctionFromList().
    // Returns the winning campaign for THIS specific page, with
    // contextual relevance (the E*TRADE-on-UK-ISA bug is fixed
    // by Layer 4: irrelevant campaigns drop out before auction).
    // --------------------------------------------------------
    // Extract a representative text sample from the page body.
    // We use the FIRST PARAGRAPH for Haiku classification (token efficiency)
    // but pass a LONGER sample (first ~1500 chars of body text) to the
    // relevance filter, because Layer 4 scores per-campaign keyword overlap
    // and short samples cause perfectly-relevant campaigns to score low.
    // Real publisher SDK (Phase 4) does the same: limited sample to Haiku,
    // fuller sample to relevance scoring.
    const allParas = [...((page.body || '').matchAll(/<p>([\s\S]*?)<\/p>/g))]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim());
    const firstParagraph = (allParas[0] || '').slice(0, 500);
    const bodySample = allParas.join(' ').slice(0, 1500);

    const matchResult = await runMatch({
      url: 'https://testbot-two-psi.vercel.app' + (page.path || req.url || '/'),
      title: page.title,
      metaDescription: page.metaDescription,
      firstParagraph,
      bodySample,
      publisherCategory: null,
    });

    const winner = matchResult.winner;

    if (!winner) {
      res.setHeader('X-Bot-Detected', 'true');
      res.setHeader('X-Bot-Platform', detection.platform || 'unknown');
      try {
        await Promise.all([
          kvIncr('stats:bot_visits:total'),   // fill-rate denominator
          kvListPush('log:recent', {
            time: new Date().toISOString(),
            ip,
            url: req.url || '/',
            platform: detection.platform,
            crawlerType: detection.crawlerType,
            confidence: detection.confidence,
            served: 'none',
            matchMethod: matchResult.method || null,
            matchReason: matchResult.reason || null,
            matchCategory: matchResult.category || null,
            matchCached: matchResult.cached || false,
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
          url: req.url || '/',
          platform: detection.platform,
          crawlerType: detection.crawlerType,
          confidence: detection.confidence,
          campaignId: winner.id,
          advertiser: winner.advertiser,
          cpmGBP: winner.cpmGBP,
          matchMethod: matchResult.method || null,
          matchCached: matchResult.cached || false,
          relevanceScore: matchResult.relevanceScore || null,
          matchCategory: matchResult.category || null,
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
