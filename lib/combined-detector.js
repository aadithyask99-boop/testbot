// ============================================================
// COMPONENT 3: Combined Confidence Scorer
// ============================================================
// Plain English: We combine the User-Agent signal and the
// behavioural signals into one final confidence score.
// Think of it like a jury — multiple witnesses, each with
// different reliability, collectively deciding a verdict.
// ============================================================

const { detectFromUserAgent } = require('./detector');
const { detectFromBehaviour } = require('./behavioural');

function analyseRequest(request) {

  const ua = request.headers['user-agent'] || '';
  const uaResult = detectFromUserAgent(ua);
  const behaviourResult = detectFromBehaviour(request.headers, request.meta || {});

  // --------------------------------------------------------
  // COMBINING SIGNALS
  // --------------------------------------------------------
  // We use a weighted combination, not a simple average.
  //
  // FACT CHECK on weights:
  // - UA match is the strongest signal (60% weight) because
  //   major AI companies DO identify themselves honestly today.
  //   This may change — hence it's not 100%.
  // - Behaviour is supporting evidence (40% weight).
  //   Alone it has too many false positives.
  //
  // HONEST LIMITATION: These weights are reasonable starting
  // points but would need tuning against real traffic data.
  // Without a large labelled dataset of bot vs human requests,
  // we're making educated estimates.
  // --------------------------------------------------------

  let finalConfidence;
  let detectionMethod;
  let commercialValue = uaResult.commercialValue;

  // --------------------------------------------------------
  // ANONYMOUS CRAWLER DETECTION (DeepSeek and similar)
  // --------------------------------------------------------
  // FACT CHECK: DeepSeek does not publish a User-Agent string.
  // Confirmed by crawlercheck.com and xseek.io — DeepSeek's
  // web fetches look like regular browser traffic in server logs.
  // Source: https://crawlercheck.com/directory/ai-bots/deepseekbot
  //
  // Detection logic: Real Chrome/Chromium browsers ALWAYS send:
  // - Accept-Language (required by HTTP spec for browsers)
  // - sec-ch-ua (mandatory in Chromium since Chrome 80, 2020)
  // - sec-fetch-mode (mandatory Fetch Metadata header)
  //
  // A request claiming to be Chrome without ANY of these headers
  // is definitively not a real browser. It's an HTTP client
  // (crawler, scraper, bot) faking a browser User-Agent.
  // --------------------------------------------------------
  const uaLower = ua.toLowerCase();
  const claimsToBeChrome = uaLower.includes('chrome') || uaLower.includes('webkit');
  const hasBrowserProofHeaders = !!(
    request.headers['accept-language'] ||
    request.headers['sec-ch-ua'] ||
    request.headers['sec-fetch-mode']
  );
  const isAnonymousCrawler = claimsToBeChrome && !hasBrowserProofHeaders && !uaResult.detected;

  if (uaResult.detected && behaviourResult.detected) {
    // Both agree — highest confidence
    finalConfidence = Math.min(100,
      (uaResult.confidence * 0.6) + (behaviourResult.confidence * 0.4)
    );
    detectionMethod = 'ua_and_behaviour';

  } else if (uaResult.detected && !behaviourResult.detected) {
    finalConfidence = uaResult.confidence * 0.85;
    detectionMethod = 'ua_only';

  } else if (isAnonymousCrawler) {
    // Chrome UA without Chrome headers = anonymous crawler
    // DeepSeek confirmed to use this pattern
    finalConfidence = 75;
    detectionMethod = 'anonymous_crawler';
    commercialValue = 'medium';

  } else if (!uaResult.detected && behaviourResult.detected) {
    finalConfidence = behaviourResult.confidence * 0.7;
    detectionMethod = 'behaviour_only';
    commercialValue = 'unknown';

  } else {
    finalConfidence = 0;
    detectionMethod = 'none';
  }

  const isBot = finalConfidence >= 70; // Threshold: 70% confidence to flag as bot

  return {
    isBot,
    confidence: Math.round(finalConfidence),
    detectionMethod,
    platform: uaResult.platform || 'unknown',
    crawlerType: uaResult.crawlerType || (isBot ? 'unknown' : null),
    commercialValue: isBot ? (commercialValue || 'unknown') : null,

    // This is the key output for your pricing model:
    // retrieval = high CPM, training = low CPM, unknown = medium CPM
    suggestedCPM: isBot ? getCPM(commercialValue, uaResult.crawlerType) : null,

    debug: {
      uaConfidence: uaResult.confidence,
      behaviourConfidence: behaviourResult.confidence,
      behaviourSignals: behaviourResult.signals,
    }
  };
}

function getCPM(value, type) {
  // FACT CHECK: These CPM rates are hypothetical starting points.
  // Real rates would be set by advertiser demand and auction dynamics.
  // Retrieval crawlers should command ~3-5x premium over training
  // because their effect on AI outputs is immediate and measurable.
  if (type === 'retrieval') return { min: 15, max: 25, currency: 'GBP', rationale: 'Real-time retrieval — immediate brand mention potential' };
  if (type === 'training') return { min: 3, max: 8, currency: 'GBP', rationale: 'Training crawler — delayed/uncertain brand mention effect' };
  return { min: 6, max: 12, currency: 'GBP', rationale: 'Unknown type — blended rate' };
}

// ============================================================
// FULL INTEGRATION TEST
// ============================================================

const scenarios = [
  {
    label: 'Perplexity crawler (ideal case — retrieval, honest UA)',
    request: {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
        'accept': '*/*',
        'host': 'finance-blog.com',
      },
      meta: { visitCount: 1, requestsPerMinute: 8 }
    }
  },
  {
    label: 'GPTBot training crawler (honest UA, low value)',
    request: {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
        'accept': 'text/html',
        'host': 'finance-blog.com',
      },
      meta: { visitCount: 1, requestsPerMinute: 12 }
    }
  },
  {
    label: 'Unknown crawler hiding identity (spoofed Chrome UA)',
    // FACT CHECK: This scenario is documented. Some scrapers deliberately
    // use Chrome User-Agents to avoid detection and blocking.
    request: {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'accept': '*/*', // But forgets to fake the Accept header
        'host': 'finance-blog.com',
        // No accept-language, no cookies, no sec headers
      },
      meta: { visitCount: 5, requestsPerMinute: 25 } // Very high request rate
    }
  },
  {
    label: 'Real human reader (Chrome)',
    request: {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-GB,en;q=0.9',
        'cookie': 'sessionid=xyz; _ga=GA1.2.123',
        'referer': 'https://google.com/',
        'sec-ch-ua': '"Google Chrome";v="120"',
        'sec-fetch-mode': 'navigate',
      },
      meta: { visitCount: 3, requestsPerMinute: 2 }
    }
  },
];

console.log('\n=== COMPONENT 3: Combined Detector — Full Analysis ===\n');

scenarios.forEach(scenario => {
  const result = analyseRequest(scenario.request);
  console.log(`📋 ${scenario.label}`);
  console.log(`   Bot: ${result.isBot} | Confidence: ${result.confidence}% | Method: ${result.detectionMethod}`);
  console.log(`   Platform: ${result.platform} | Type: ${result.crawlerType} | Value: ${result.commercialValue}`);
  if (result.suggestedCPM) {
    console.log(`   CPM: £${result.suggestedCPM.min}-${result.suggestedCPM.max} — ${result.suggestedCPM.rationale}`);
  }
  console.log();
});

module.exports = { analyseRequest };
