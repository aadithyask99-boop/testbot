// ============================================================
// AI AD PLATFORM — CLOUDFLARE WORKER (Session 7 proof-of-concept)
// ============================================================
// See WORKER_SDK_SPEC.md for the full design.
//
// PROOF-OF-CONCEPT SCOPE: this Worker proxies testbot-two-psi.vercel.app
// itself (ORIGIN_URL below). It proves the mechanism — bot detection,
// /match call, HTML injection, impression logging — using OUR OWN demo
// pages as the "publisher site." To point this at a REAL publisher,
// change ORIGIN_URL to their domain; everything else is unchanged.
//
// IMPORTANT: the Worker's fetch to ORIGIN_URL uses a UA that
// api/index.js's bot detector will NOT classify as a bot (see
// WORKER_FETCH_UA below). This ensures the origin serves the CLEAN,
// UNMODIFIED page to the Worker — the WORKER is the sole injector and
// logger for ITS visitors. If the origin's bot detector also fired on
// the Worker's fetch, BOTH would inject + log, double-counting.
// ============================================================

const ORIGIN_URL = 'https://testbot-two-psi.vercel.app';
const PLATFORM_URL = 'https://testbot-two-psi.vercel.app'; // /match + /impression + /click all live here
const WORKER_FETCH_UA = 'Mozilla/5.0 (compatible; TestbotWorkerProxy/1.0)';

// ------------------------------------------------------------
// BOT_PATTERNS — generated from lib/detector.js via
// scripts/generate-worker-detector.js. v1 scope: self-identifying
// crawlers only (simple substring match against User-Agent).
// Regenerate after adding/removing major crawlers in lib/detector.js.
// ------------------------------------------------------------
const BOT_PATTERNS = [
  { "name": "Perplexity", "patterns": ["PerplexityBot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "ChatGPT Browse", "patterns": ["ChatGPT-User"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Bing Copilot", "patterns": ["bingbot", "BingPreview"], "type": "retrieval", "cloakingRisk": false },
  { "name": "You.com", "patterns": ["YouBot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Claude (Anthropic retrieval)", "patterns": ["Claude-User", "claude-user"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Perplexity User", "patterns": ["Perplexity-User"], "type": "retrieval", "cloakingRisk": false },
  { "name": "SearchGPT", "patterns": ["OAI-SearchBot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "GPTBot (OpenAI training)", "patterns": ["GPTBot"], "type": "training", "cloakingRisk": false },
  { "name": "ClaudeBot (Anthropic)", "patterns": ["ClaudeBot", "anthropic-ai"], "type": "training", "cloakingRisk": false },
  { "name": "Googlebot", "patterns": ["Googlebot"], "type": "training", "cloakingRisk": true },
  { "name": "GoogleOther", "patterns": ["GoogleOther"], "type": "training", "cloakingRisk": true },
  { "name": "Applebot Extended (Apple Intelligence)", "patterns": ["Applebot-Extended"], "type": "training", "cloakingRisk": false },
  { "name": "OAI-AdsBot (OpenAI)", "patterns": ["OAI-AdsBot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Amzn-SearchBot (Amazon)", "patterns": ["Amzn-SearchBot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Amzn-User (Amazon)", "patterns": ["Amzn-User"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Cohere", "patterns": ["cohere-ai"], "type": "training", "cloakingRisk": false },
  { "name": "Bytespider (TikTok)", "patterns": ["Bytespider"], "type": "training", "cloakingRisk": false },
  { "name": "Meta AI (training)", "patterns": ["FacebookBot", "meta-externalagent", "Meta-ExternalAgent"], "type": "training", "cloakingRisk": false },
  { "name": "Meta AI (retrieval)", "patterns": ["Meta-ExternalFetcher", "meta-externalfetcher"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Meta WebIndexer", "patterns": ["meta-webindexer", "Meta-WebIndexer"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Google NotebookLM", "patterns": ["Google-NotebookLM"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Google CloudVertex", "patterns": ["Google-CloudVertexBot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "DuckAssistBot", "patterns": ["DuckAssistBot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Mistral AI", "patterns": ["MistralAI-User", "mistralai"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Claude SearchBot", "patterns": ["Claude-SearchBot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Google Agent (Gemini retrieval)", "patterns": ["Google-Agent"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Gemini Deep Research", "patterns": ["Gemini-Deep-Research"], "type": "retrieval", "cloakingRisk": false },
  { "name": "DeepSeek (training)", "patterns": ["DeepSeekBot", "deepseek-bot"], "type": "training", "cloakingRisk": false },
  { "name": "xAI Grok", "patterns": ["xAI-Bot", "xai-bot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "CCBot (Common Crawl)", "patterns": ["CCBot"], "type": "training", "cloakingRisk": false },
  { "name": "Amazonbot", "patterns": ["Amazonbot"], "type": "training", "cloakingRisk": false },
  { "name": "Kimi (Moonshot AI)", "patterns": ["Kimibot", "KimiCrawler", "MoonshotBot"], "type": "retrieval", "cloakingRisk": false },
  { "name": "Qwen (Alibaba)", "patterns": ["QwenBot", "TongyiBot", "AliyunBot"], "type": "training", "cloakingRisk": false },
  { "name": "Baidu ERNIE", "patterns": ["ERNIEBot", "YiyanBot"], "type": "training", "cloakingRisk": false },
  { "name": "Doubao (ByteDance)", "patterns": ["Doubaobot", "TikTokSpider"], "type": "training", "cloakingRisk": false },
];

// Detect a bot from the User-Agent and request headers.
// Returns { isBot, name, type, cloakingRisk, detectionMethod } or { isBot: false }.
// v2: adds anonymous crawler detection for bots faking browser UAs (e.g. DeepSeek).
// Mirrors lib/combined-detector.js's anonymous_crawler path.
function detectBot(userAgent, request) {
  if (!userAgent) return { isBot: false };

  // Layer 1: UA pattern match (self-identifying bots)
  for (const entry of BOT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (userAgent.includes(pattern)) {
        return {
          isBot: true,
          name: entry.name,
          type: entry.type,
          cloakingRisk: entry.cloakingRisk,
          detectionMethod: 'ua_match',
          confidence: 85,
        };
      }
    }
  }

  // Layer 2: Anonymous crawler detection (DeepSeek pattern)
  // Real Chrome/Chromium browsers ALWAYS send Accept-Language, sec-ch-ua,
  // or sec-fetch-mode. A Chrome UA without ANY of these is not a real browser.
  if (request) {
    const uaLower = userAgent.toLowerCase();
    const claimsToBeChrome = uaLower.includes('chrome') || uaLower.includes('webkit');
    const hasBrowserProof = !!(
      request.headers.get('accept-language') ||
      request.headers.get('sec-ch-ua') ||
      request.headers.get('sec-fetch-mode')
    );
    if (claimsToBeChrome && !hasBrowserProof) {
      return {
        isBot: true,
        name: 'Anonymous Crawler (DeepSeek pattern)',
        type: 'retrieval',
        cloakingRisk: false,
        detectionMethod: 'anonymous_crawler',
        confidence: 75,
      };
    }
  }

  return { isBot: false };
}

// ------------------------------------------------------------
// Page-signal extraction via HTMLRewriter.
// Collects title, meta description, and text from article paragraphs —
// mirrors api/index.js's extraction (which uses ALL <p> elements from
// page.body up to 1500 chars; v1 here uses the first 2 non-byline
// paragraphs, sufficient for classification/relevance and avoids
// buffering the whole page).
//
// KNOWN V1 LIMITATIONS:
// 1. Scoped to `article p` (see injectIntoResponse for why the header's
//    tagline <p> must not count). Assumes an <article> wrapper, true
//    for all of lib/demo-pages.js. A real publisher's page may not use
//    <article> — if `article p` matches zero elements, paragraphCount
//    is 0 and injection falls back to "before </body>" (still works,
//    loses "after the intro" placement). v2: fall back to plain `p` or
//    a content-area heuristic (main, [role=main], .content,
//    .post-content) if article-scoped matches are zero.
// 2. SIGNALS additionally exclude `.byline` — lib/demo-pages.js's
//    makePage() template always has `<p class="byline">By ... ·
//    DATE</p>` as the first article p, and api/index.js's own
//    extraction (from page.body, which excludes the byline) never sees
//    it. Without excluding it here, the Worker's "firstParagraph" would
//    be byline text instead of real content — worse signal quality than
//    the origin. `:not(.byline)` is a best-effort match for THIS demo
//    template; a real publisher's byline markup will differ or be
//    absent. The byline STILL counts toward injection positioning
//    (articlePCount) — see injectIntoResponse.
// ------------------------------------------------------------
function extractSignals(response) {
  const signals = { title: '', metaDescription: '', paragraphs: [], articlePCount: 0, mainPCount: 0 };
  let articlePCount = 0;
  let mainPCount = 0;

  const rewriter = new HTMLRewriter()
    .on('title', {
      text(text) { signals.title += text.text; },
    })
    .on('meta[name="description"]', {
      element(el) {
        const content = el.getAttribute('content');
        if (content) signals.metaDescription = content;
      },
    })
    // Primary: article p (our demo pages + well-structured publishers)
    .on('article p', {
      element(el) { articlePCount++; },
    })
    .on('article p:not(.byline)', {
      text(text) {
        if (signals.paragraphs.length === 0) signals.paragraphs.push('');
        const idx = signals._currentP ?? signals.paragraphs.length - 1;
        signals.paragraphs[idx] = (signals.paragraphs[idx] || '') + text.text;
        if (text.lastInTextNode) signals._currentP = undefined;
      },
      element(el) {
        signals.paragraphs.push('');
        signals._currentP = signals.paragraphs.length - 1;
      },
    })
    // Fallback: main p (catches publishers without <article>)
    .on('main p', {
      element(el) { mainPCount++; },
    })
    .on('[role=main] p', {
      element(el) { mainPCount++; },
    });

  return rewriter.transform(response.clone()).text().then(() => {
    // If article had no paragraphs, re-scan using main p as fallback.
    // Signals extraction runs again on a fresh clone — cheap since
    // it's a text parse, not a network request.
    const usingFallback = articlePCount === 0 && mainPCount > 0;
    const firstParagraph = (signals.paragraphs[0] || '').trim().slice(0, 500);
    const bodySample = signals.paragraphs.join(' ').trim().slice(0, 1500);
    return {
      title: signals.title.trim(),
      metaDescription: signals.metaDescription,
      firstParagraph,
      bodySample,
      paragraphCount: articlePCount,
      mainParagraphCount: mainPCount,
      usingFallback,
    };
  });
}

// ------------------------------------------------------------
// Injection — mirrors lib/injector.js's output format:
//   <p>{variantText} <a href="{clickUrl}">{linkText} →</a></p>
// inserted after the 2nd <p> element (HTMLRewriter equivalent of
// "2nd </p> after 200 chars" — at this scale the distinction is
// immaterial; both target "after the intro"). Falls back to before
// </body> if fewer than 2 <p> elements exist.
// ------------------------------------------------------------
function buildInjectedHtml(variant, winner) {
  let text = variant.text;
  if (winner.link && winner.advSlug) {
    const clickUrl = `${PLATFORM_URL}/click?adv=${encodeURIComponent(winner.advSlug)}&dest=${encodeURIComponent(winner.link)}`;
    const linkLabel = winner.linkText || 'Learn more';
    text = `${text} <a href="${clickUrl}">${linkLabel} →</a>`;
  }
  // No class, no comment — plain <p>, structurally identical to editorial
  // content. Same no-fingerprinting rule as lib/injector.js.
  return `<p>${text}</p>`;
}

function injectIntoResponse(response, injectedHtml, paragraphCount, mainParagraphCount) {
  let pSeen = 0;
  let injected = false;
  const useMain = paragraphCount === 0 && mainParagraphCount > 0;
  const targetSelector = useMain ? 'main p' : 'article p';

  const rewriter = new HTMLRewriter()
    .on(targetSelector, {
      element(el) {
        pSeen++;
        // After the 1st content paragraph (byline-equivalent position).
        // For main p fallback, inject after the 2nd p (no byline to skip).
        const threshold = useMain ? 2 : 1;
        const hasEnough = useMain ? mainParagraphCount >= 2 : paragraphCount >= 1;
        if (pSeen === threshold && hasEnough && !injected) {
          el.after(injectedHtml, { html: true });
          injected = true;
        }
      },
    })
    .on('body', {
      element(el) {
        // Final fallback: no article p AND no main p — append before </body>
        if (!injected && paragraphCount < 1 && mainParagraphCount < 2) {
          el.append(injectedHtml, { html: true });
          injected = true;
        }
      },
    });

  return rewriter.transform(response);
}

// ------------------------------------------------------------
// Fire-and-forget impression logging. Failures are non-fatal — an
// impression-logging hiccup must never affect what's served.
// Session 8: passes full match metadata so Worker-sourced log:recent
// entries have the same shape as api/index.js entries — fixes the
// dashboard's Why-box showing only "X served." for Worker impressions.
// ------------------------------------------------------------
async function logImpression(ctx, { campaignId, variantId, platform, crawlerType, url, advertiser, cpmGBP,
  pubId, matchMethod, matchCached, matchCategory, relevanceScore, candidates, variantAngle, variantMethod }) {
  ctx.waitUntil(
    fetch(`${PLATFORM_URL}/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId, variantId, platform, crawlerType, url, advertiser, cpmGBP, source: 'worker',
        pubId: pubId || null,
        matchMethod: matchMethod || null,
        matchCached: matchCached || false,
        matchCategory: matchCategory || null,
        relevanceScore: relevanceScore || null,
        candidates: candidates || null,
        variantAngle: variantAngle || null,
        variantMethod: variantMethod || null,
        served: 'yes',
      }),
    }).catch(e => console.error('impression log failed (non-fatal):', e.message))
  );
}

// ------------------------------------------------------------
// MAIN HANDLER
// ------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = request.headers.get('User-Agent') || '';

    // Fetch the origin page. v1: ORIGIN_URL is hardcoded to
    // testbot-two-psi.vercel.app itself (proof-of-concept). For a real
    // publisher, this becomes their own origin (e.g. via env binding).
    const originRequest = new Request(ORIGIN_URL + url.pathname + url.search, {
      method: request.method,
      headers: new Headers(request.headers),
    });
    originRequest.headers.set('User-Agent', WORKER_FETCH_UA);

    const originResponse = await fetch(originRequest);

    // Only attempt injection on HTML responses.
    const contentType = originResponse.headers.get('Content-Type') || '';
    if (!contentType.includes('text/html')) {
      return originResponse;
    }

    const detection = detectBot(ua, request);

    // Human, or a bot we don't recognise: pass through unmodified.
    // Cloaking-risk bots (Googlebot/GoogleOther): pass through
    // unmodified — same rule as api/index.js / lib/detector.js.
    if (!detection.isBot || detection.cloakingRisk) {
      return originResponse;
    }

    // Extract page signals from the (cloned) origin response.
    const signals = await extractSignals(originResponse);

    // Call /match for the winning campaign + selected variant.
    let matchResult;
    try {
      const matchResp = await fetch(`${PLATFORM_URL}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.toString(),
          title: signals.title,
          metaDescription: signals.metaDescription,
          firstParagraph: signals.firstParagraph,
          bodySample: signals.bodySample,
        }),
      });
      matchResult = await matchResp.json();
    } catch (e) {
      // /match unreachable — serve the clean page. Never break the
      // publisher's site because OUR API had a hiccup.
      return originResponse;
    }

    const winner = matchResult && matchResult.winner;
    const variant = matchResult && matchResult.selectedVariant;

    if (!winner || !variant) {
      // No eligible campaign for this page — serve clean, but still
      // worth knowing a bot visited (impression with no campaign).
      // v1: skip logging the no-match case to keep /impression's
      // contract simple (campaignId required) — see WORKER_SDK_SPEC.md
      // build order item 4 for the fuller schema if this is wanted later.
      return originResponse;
    }

    const injectedHtml = buildInjectedHtml(variant, winner);
    const modifiedResponse = injectIntoResponse(originResponse, injectedHtml, signals.paragraphCount, signals.mainParagraphCount || 0);

    logImpression(ctx, {
      campaignId: winner.id,
      variantId: variant.id,
      platform: detection.name,
      crawlerType: detection.type,
      url: url.toString(),
      advertiser: winner.advertiser,
      cpmGBP: winner.cpmGBP,
      // Session 8: full match metadata for Why-box + per-publisher tracking
      pubId: matchResult.pubId || null,
      matchMethod: matchResult.method || null,
      matchCached: matchResult.cached || false,
      matchCategory: matchResult.category || null,
      relevanceScore: matchResult.relevanceScore || null,
      candidates: matchResult.candidates || null,
      variantAngle: (variant && variant.angle) || null,
      variantMethod: matchResult.variantMethod || null,
    });

    return modifiedResponse;
  },
};
