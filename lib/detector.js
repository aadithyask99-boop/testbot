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
    name: 'Google-Extended',
    patterns: ['Google-Extended'],
    type: 'training',
    value: 'low',
    // FACT CHECK: Google created this specifically so publishers can
    // block it separately from Googlebot. It feeds Gemini training.
    // Confirmed at developers.google.com
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
    name: 'Meta AI',
    patterns: ['FacebookBot', 'meta-externalagent'],
    type: 'unknown',
    value: 'medium',
    // FACT CHECK: Meta uses FacebookBot for general crawling.
    // meta-externalagent is newer and specifically for AI.
    // Confirmed at developers.facebook.com
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
          confidence: 95, // Very high — UA match is strong signal
          reason: 'user_agent_match',
          platform: crawler.name,
          crawlerType: crawler.type,
          commercialValue: crawler.value,
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
