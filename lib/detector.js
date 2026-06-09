// ============================================================
// COMPONENT 1: User-Agent Detection
// ============================================================
// Plain English: Every HTTP request has a "User-Agent" header.
// It's like a name tag the visitor wears. We check if that
// name tag matches a known AI crawler.
// ============================================================

const AI_CRAWLERS = [

  // --- RETRIEVAL CRAWLERS (high commercial value) ---
  // These visit your page RIGHT NOW to answer a user's question.
  // Injection has near-instant effect on AI responses.
  {
    name: 'Perplexity',
    patterns: ['PerplexityBot'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Confirmed at docs.perplexity.ai/docs/perplexitybot
  },
  {
    name: 'ChatGPT Browse',
    patterns: ['ChatGPT-User'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Confirmed at platform.openai.com/docs/plugins/bot
    // NOTE: ChatGPT-User = user-triggered browse. GPTBot = background training.
    // This distinction is CRITICAL for commercial value.
  },
  {
    name: 'Bing Copilot',
    patterns: ['bingbot', 'BingPreview'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Bing uses standard bingbot for Copilot retrieval too.
    // Cannot always distinguish Copilot retrieval from standard index crawl.
    // HONEST LIMITATION: this is an imperfect signal.
  },
  {
    name: 'You.com',
    patterns: ['YouBot'],
    type: 'retrieval',
    value: 'medium',
    // FACT CHECK: You.com is an AI search engine that does real-time retrieval.
  },
  {
    name: 'Claude (Anthropic retrieval)',
    patterns: ['Claude-User', 'claude-user'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Claude-User is Anthropic's retrieval crawler — used when
    // Claude fetches live web pages during a conversation. Distinct from
    // ClaudeBot which is the training crawler. Confirmed from live dashboard
    // observation — appeared at 15:24 on first real-world test.
  },
  {
    name: 'Perplexity User',
    patterns: ['Perplexity-User'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Perplexity-User appeared in live dashboard logs alongside
    // PerplexityBot during real Perplexity query test. Likely the user-session
    // request that precedes the crawler fetch.
  },
  {
    name: 'Gemini (Google AI)',
    patterns: ['Google-CloudVertexBot', 'Googlebot-AI'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Google's AI retrieval crawlers for Gemini responses.
  },
  {
    name: 'SearchGPT',
    patterns: ['OAI-SearchBot'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: OpenAI's SearchGPT product uses OAI-SearchBot for retrieval.
    // Confirmed in OpenAI's crawler documentation 2024.
  },

  // --- TRAINING CRAWLERS (lower commercial value) ---
  // These visit to build datasets for future model training.
  // Effect on AI responses is delayed 6-18 months, if at all.
  {
    name: 'GPTBot (OpenAI training)',
    patterns: ['GPTBot'],
    type: 'training',
    value: 'low',
    // FACT CHECK: Confirmed at platform.openai.com/docs/gptbot
    // OpenAI explicitly states this is for training, not real-time retrieval.
  },
  {
    name: 'ClaudeBot (Anthropic)',
    patterns: ['ClaudeBot', 'anthropic-ai'],
    type: 'training',
    value: 'low',
    // FACT CHECK: Confirmed at support.anthropic.com/en/articles/8896518
  },
  {
    name: 'Googlebot',
    patterns: ['Googlebot'],
    type: 'training',
    value: 'none',
    cloakingRisk: true,
    // FACT CHECK: Googlebot is Google's main search crawler.
    // Serving different content to Googlebot = cloaking = SEO penalty.
    // We detect it to log the visit but NEVER inject on it.
  },
  {
    name: 'GoogleOther',
    patterns: ['GoogleOther'],
    type: 'training',
    value: 'low',
    // FACT CHECK: GoogleOther is Google's generic crawler used by various
    // product teams including Gemini grounding. Confirmed at:
    // developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers
    // NOTE: Google-Extended has NO HTTP User-Agent string — it is a
    // robots.txt control token only and will never appear in server logs.
    // Source: official Google crawlers documentation April 2026
    // IMPORTANT: We detect GoogleOther but DO NOT inject on it —
    // injecting on any Googlebot variant constitutes cloaking.
    // Flag it as cloaking_risk so index.js skips injection.
    cloakingRisk: true,
  },
  {
    name: 'Applebot Extended (Apple Intelligence)',
    patterns: ['Applebot-Extended'],
    type: 'training',
    value: 'medium',
    // FACT CHECK: Apple Intelligence crawler. Confirmed by both
    // henu-wang/ai-crawlers-reference and ipanalytics/CrawlerScope.
    // Opt-in only — Apple requires explicit robots.txt allowance.
    // Distinct from Applebot (standard Apple search crawler).
  },
  {
    name: 'OAI-AdsBot (OpenAI)',
    patterns: ['OAI-AdsBot'],
    type: 'retrieval',
    value: 'medium',
    // FACT CHECK: OpenAI's advertising bot. Documented UA with no
    // published IP list. Source: ipanalytics/CrawlerScope May 2026.
  },
  {
    name: 'Amzn-SearchBot (Amazon)',
    patterns: ['Amzn-SearchBot'],
    type: 'retrieval',
    value: 'medium',
    // FACT CHECK: Amazon's AI search crawler. Official embedded JSON
    // source, 512 published IP prefixes.
    // Source: ipanalytics/CrawlerScope May 2026.
  },
  {
    name: 'Amzn-User (Amazon)',
    patterns: ['Amzn-User'],
    type: 'retrieval',
    value: 'medium',
    // FACT CHECK: Amazon's user-triggered fetcher. 1,023 published
    // IP prefixes — the largest Amazon crawler footprint.
    // Source: ipanalytics/CrawlerScope May 2026.
  },
  {
    name: 'Cohere',
    patterns: ['cohere-ai'],
    type: 'training',
    value: 'low',
  },
  {
    name: 'Bytespider (TikTok)',
    patterns: ['Bytespider'],
    type: 'training',
    value: 'low',
    // FACT CHECK: ByteDance crawler. Feeds various AI products.
  },

  // --- UNKNOWN / EMERGING ---
  {
    name: 'Meta AI (training)',
    patterns: ['FacebookBot', 'meta-externalagent', 'Meta-ExternalAgent'],
    type: 'training',
    value: 'low',
    // FACT CHECK: meta-externalagent = broad training crawler
    // Confirmed at developers.facebook.com and aicrawlercheck.com 2026
  },
  {
    name: 'Meta AI (retrieval)',
    patterns: ['Meta-ExternalFetcher', 'meta-externalfetcher'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Meta-ExternalFetcher handles real-time content retrieval
    // when users ask Meta AI questions that need fresh web data.
    // Source: aicrawlercheck.com/blog/meta-external-agent-facebook-ai-crawler
  },
  {
    name: 'Meta WebIndexer',
    patterns: ['meta-webindexer', 'Meta-WebIndexer'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Used for indexing Meta AI search results.
    // Meta notes allowing this crawler supports Meta AI citing your content.
    // Source: 51degrees.com/blog/meta-crawlers-2026
  },
  {
    name: 'Google NotebookLM',
    patterns: ['Google-NotebookLM'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Google NotebookLM retrieval crawler.
    // Source: nohacks.co/blog/ai-user-agents-landscape-2026
  },
  {
    name: 'Google CloudVertex',
    patterns: ['Google-CloudVertexBot'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Google Vertex AI retrieval crawler.
    // Source: nohacks.co/blog/ai-user-agents-landscape-2026
  },
  {
    name: 'DuckAssistBot',
    patterns: ['DuckAssistBot'],
    type: 'retrieval',
    value: 'medium',
    // FACT CHECK: DuckDuckGo AI answer feature crawler.
    // Source: momenticmarketing.com/blog/ai-search-crawlers-bots
  },
  {
    name: 'Mistral AI',
    patterns: ['MistralAI-User', 'mistralai'],
    type: 'retrieval',
    value: 'medium',
    // FACT CHECK: Mistral AI retrieval crawler.
    // Source: nohacks.co/blog/ai-user-agents-landscape-2026
  },
  {
    name: 'Claude SearchBot',
    patterns: ['Claude-SearchBot'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Anthropic search-specific retrieval bot.
    // Source: nohacks.co/blog/ai-user-agents-landscape-2026
  },
  {
    name: 'Google Agent (Gemini retrieval)',
    patterns: ['Google-Agent'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Confirmed by Search Engine Journal March 2026.
    // Google-Agent is a user-triggered retrieval crawler for
    // Gemini agents navigating the web on behalf of users.
    // Source: developers.google.com/crawling/docs/crawlers-fetchers/google-agent
  },
  {
    name: 'Gemini Deep Research',
    patterns: ['Gemini-Deep-Research'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Confirmed at crawlercheck.com February 2026.
    // High-intensity agent for multi-hop reasoning tasks in Gemini.
  },
  {
    name: 'DeepSeek (training)',
    patterns: ['DeepSeekBot', 'deepseek-bot'],
    type: 'training',
    value: 'low',
    // FACT CHECK: DeepSeekBot is used for training crawls.
    // DeepSeek's web search/retrieval requests arrive with NO user agent.
    // Confirmed by xseek.io/docs/deepseek-user-agents April 2026.
    // The anonymous_crawler path in combined-detector.js handles those.
  },

  {
    name: 'xAI Grok',
    patterns: ['xAI-Bot', 'xai-bot'],
    type: 'retrieval',
    value: 'high',
    // FACT CHECK: Grok's web crawler. Confirmed in go-ua-parser
    // open source bot database (313 verified bots, May 2026).
    // Grok does real-time web retrieval — confirmed working in
    // our own tests earlier today.
  },
  {
    name: 'CCBot (Common Crawl)',
    patterns: ['CCBot'],
    type: 'training',
    value: 'low',
    // FACT CHECK: Common Crawl's bot. Its crawled data feeds
    // training datasets for many AI models including early GPT.
    // Confirmed in go-ua-parser AI crawler list.
  },
  {
    name: 'Amazonbot',
    patterns: ['Amazonbot'],
    type: 'training',
    value: 'low',
    // FACT CHECK: Amazon's AI crawler. Feeds Alexa and Amazon
    // AI products. Confirmed in go-ua-parser AI crawler list.
  },

  // --------------------------------------------------------
  // CHINESE AI SYSTEMS — verified UA strings from xseek.io
  // --------------------------------------------------------

  {
    name: 'Kimi (Moonshot AI)',
    patterns: ['Kimibot', 'KimiCrawler', 'MoonshotBot'],
    type: 'retrieval',
    value: 'medium',
    // FACT CHECK: Moonshot AI's primary crawler. Feeds Kimi's knowledge
    // base and fetches URLs users paste into chat.
    // Source: xseek.io/docs/kimi-user-agents April 2026
    // UA: Mozilla/5.0 (compatible; Kimibot/1.0; +https://kimi.moonshot.cn/kimibot)
  },
  {
    name: 'Qwen (Alibaba)',
    patterns: ['QwenBot', 'TongyiBot', 'AliyunBot'],
    type: 'training',
    value: 'low',
    // FACT CHECK: Alibaba's Qwen crawlers. 40M+ MAU, deep e-commerce
    // integration. Primarily training/knowledge base, not live retrieval.
    // Source: xseek.io/docs/qwen-user-agents April 2026
    // UA: Mozilla/5.0 (compatible; QwenBot/1.0; +https://tongyi.aliyun.com/bot)
  },
  {
    name: 'Baidu ERNIE',
    patterns: ['ERNIEBot', 'YiyanBot'],
    type: 'training',
    value: 'low',
    // FACT CHECK: Baidu's AI crawlers. 200M+ MAU in China.
    // ERNIEBot feeds ERNIE Bot's responses. YiyanBot backs the assistant UI.
    // NOTE: Do NOT add Baiduspider — blocking it kills Baidu Search rankings.
    // Source: xseek.io/docs/baidu-ernie-user-agents April 2026
    // UA: Mozilla/5.0 (compatible; ERNIEBot/1.0; +https://yiyan.baidu.com/bot)
  },
  {
    name: 'Doubao (ByteDance)',
    patterns: ['Doubaobot', 'TikTokSpider'],
    type: 'training',
    value: 'low',
    // FACT CHECK: ByteDance's Doubao AI crawler. 35M+ MAU.
    // Doubaobot = AI-specific. TikTokSpider = video ecosystem content.
    // NOTE: Bytespider already exists separately in this database.
    // Source: xseek.io/docs/doubao-user-agents April 2026
    // UA: Mozilla/5.0 (compatible; Doubaobot/1.0; +https://www.doubao.com/bot)
  },
];

// ============================================================
// THE DETECTION FUNCTION
// ============================================================
// Input:  a User-Agent string from an HTTP request header
// Output: detection result object
// ============================================================

function detectFromUserAgent(userAgentString) {

  // Edge case: no User-Agent at all
  // FACT CHECK: Bots sometimes send empty UA strings.
  // Humans almost never do (every browser sends one).
  // Empty UA is a weak bot signal but not conclusive.
  if (!userAgentString || userAgentString.trim() === '') {
    return {
      detected: false,
      confidence: 20, // Low confidence — suspicious but not certain
      reason: 'empty_user_agent',
      platform: null,
      crawlerType: null,
      commercialValue: null,
    };
  }

  const ua = userAgentString.toLowerCase();

  // Check against every known crawler pattern
  for (const crawler of AI_CRAWLERS) {
    for (const pattern of crawler.patterns) {
      if (ua.includes(pattern.toLowerCase())) {
        return {
          detected: true,
          confidence: 95,
          reason: 'user_agent_match',
          platform: crawler.name,
          crawlerType: crawler.type,
          commercialValue: crawler.value,
          cloakingRisk: crawler.cloakingRisk || false,
          matchedPattern: pattern,
        };
      }
    }
  }

  // No match found — looks like a human browser
  return {
    detected: false,
    confidence: 0,
    reason: 'no_match',
    platform: null,
    crawlerType: null,
    commercialValue: null,
  };
}

// ============================================================
// TEST SUITE — verify this actually works
// ============================================================

const testCases = [
  // Real crawler UAs (from official docs)
  {
    label: 'OpenAI GPTBot (training)',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)',
    expect: { detected: true, platform: 'GPTBot (OpenAI training)', type: 'training' }
  },
  {
    label: 'ChatGPT Browse (retrieval)',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
    expect: { detected: true, platform: 'ChatGPT Browse', type: 'retrieval' }
  },
  {
    label: 'Perplexity (retrieval)',
    ua: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    expect: { detected: true, platform: 'Perplexity', type: 'retrieval' }
  },
  {
    label: 'Anthropic ClaudeBot (training)',
    ua: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    expect: { detected: true, platform: 'ClaudeBot (Anthropic)', type: 'training' }
  },
  // Regular human browser — should NOT be detected
  {
    label: 'Chrome browser (human)',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    expect: { detected: false }
  },
  // Safari on iPhone — should NOT be detected
  {
    label: 'Safari iPhone (human)',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    expect: { detected: false }
  },
  // FACT CHECK TEST: What if someone spoofs a GPTBot UA?
  // This is a real attack vector. We flag it but note we can't verify it.
  {
    label: 'Spoofed GPTBot (anyone can do this)',
    ua: 'GPTBot/1.0',
    expect: { detected: true, note: 'KNOWN LIMITATION: Cannot verify if this is real OpenAI or a spoof' }
  },
];

console.log('\n=== COMPONENT 1: User-Agent Detection — Test Results ===\n');

let passed = 0;
let failed = 0;

testCases.forEach(test => {
  const result = detectFromUserAgent(test.ua);
  const detectionMatch = result.detected === test.expect.detected;
  const typeMatch = !test.expect.type || result.crawlerType === test.expect.type;
  const pass = detectionMatch && typeMatch;

  if (pass) passed++;
  else failed++;

  const icon = pass ? '✓ PASS' : '✗ FAIL';
  console.log(`${icon} | ${test.label}`);
  console.log(`       Detected: ${result.detected} | Platform: ${result.platform || 'none'} | Type: ${result.crawlerType || 'n/a'} | Value: ${result.commercialValue || 'n/a'}`);
  if (test.expect.note) console.log(`       ⚠ NOTE: ${test.expect.note}`);
  console.log();
});

console.log(`Results: ${passed} passed, ${failed} failed`);

module.exports = { detectFromUserAgent, AI_CRAWLERS };
