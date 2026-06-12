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

// Detect a bot from the User-Agent. Returns { isBot, name, type,
// cloakingRisk } or { isBot: false }. v1: simple substring match,
// case-sensitive (matches lib/detector.js's behaviour for these entries
// — the patterns themselves include both-case variants where relevant,
// e.g. "Claude-User" and "claude-user" as separate entries).
function detectBot(userAgent) {
  if (!userAgent) return { isBot: false };
  for (const entry of BOT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (userAgent.includes(pattern)) {
        return { isBot: true, name: entry.name, type: entry.type, cloakingRisk: entry.cloakingRisk };
      }
    }
  }
  return { isBot: false };
}

// ------------------------------------------------------------
// Page-signal extraction via HTMLRewriter.
// Collects title, meta description, and text from the first two <p>
// elements (firstParagraph = 1st, bodySample = both joined) — mirrors
// api/index.js's extraction (which uses ALL <p> elements up to 1500
// chars; v1 here uses the first 2, sufficient for classification/
// relevance and avoids buffering the whole page to extract signals).
//
// KNOWN V1 LIMITATION: scoped to `article p` (see injectIntoResponse
// for why). This assumes the page has an <article> wrapper, true for
// all of lib/demo-pages.js. A REAL publisher's page may not use
// <article> — if `article p` matches zero elements, paragraphCount
// will be 0 and injection falls back to "before </body>" (the
// lib/injector.js fallback), which still works but loses the "after
// the intro" placement. v2: detect zero article-scoped matches and
// fall back to plain `p`, OR use a content-area heuristic (main,
// [role=main], .content, .post-content — common publisher patterns).
// Not built in this session — testbot-two-psi's demo pages all use
// <article>, so this doesn't block the proof-of-concept.
// ------------------------------------------------------------
function extractSignals(response) {
  const signals = { title: '', metaDescription: '', paragraphs: [] };

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
    // Scoped to `article p` — see injectIntoResponse for why the
    // header's tagline <p> must not be counted as a body paragraph.
    .on('article p', {
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
    });

  // Run the rewriter over a CLONED response so we don't consume the
  // body we need to return/inject into.
  return rewriter.transform(response.clone()).text().then(() => {
    const firstParagraph = (signals.paragraphs[0] || '').trim().slice(0, 500);
    const bodySample = signals.paragraphs.join(' ').trim().slice(0, 1500);
    return {
      title: signals.title.trim(),
      metaDescription: signals.metaDescription,
      firstParagraph,
      bodySample,
      paragraphCount: signals.paragraphs.length,
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

function injectIntoResponse(response, injectedHtml, paragraphCount) {
  let pSeen = 0;
  let injected = false;

  const rewriter = new HTMLRewriter()
    // Scoped to `article p` — the header's tagline <p> (e.g.
    // "<header>...<p>UK personal finance &amp; investing</p></header>")
    // must NOT count toward "the 2nd paragraph." This mirrors
    // lib/injector.js's behaviour, which starts its search at character
    // 200 (past the <header> block) — counting from the start of
    // <article> achieves the same intent via HTMLRewriter's selector
    // scoping instead of a character offset.
    .on('article p', {
      element(el) {
        pSeen++;
        if (pSeen === 2 && paragraphCount >= 2) {
          el.after(injectedHtml, { html: true });
          injected = true;
        }
      },
    })
    .on('body', {
      element(el) {
        if (paragraphCount < 2) {
          // Fallback: fewer than 2 <p> elements inside <article> —
          // append before </body>, mirroring lib/injector.js's
          // injectBeforeBodyClose fallback.
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
// ------------------------------------------------------------
async function logImpression(ctx, { campaignId, variantId, platform, crawlerType, url, advertiser, cpmGBP }) {
  ctx.waitUntil(
    fetch(`${PLATFORM_URL}/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, variantId, platform, crawlerType, url, advertiser, cpmGBP, source: 'worker' }),
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

    const detection = detectBot(ua);

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
    const modifiedResponse = injectIntoResponse(originResponse, injectedHtml, signals.paragraphCount);

    logImpression(ctx, {
      campaignId: winner.id,
      variantId: variant.id,
      platform: detection.name,
      crawlerType: detection.type,
      url: url.toString(),
      advertiser: winner.advertiser,
      cpmGBP: winner.cpmGBP,
    });

    return modifiedResponse;
  },
};
