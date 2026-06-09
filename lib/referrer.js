// ============================================================
// REFERRER DETECTION — AI platform click tracking
// ============================================================
// When a human visits your page after seeing it cited in an
// AI response, their browser sends a Referer header showing
// which platform they came from. This file detects those
// referrers and extracts the query where possible.
// ============================================================

const AI_REFERRER_PLATFORMS = [
  { match: 'perplexity.ai',      platform: 'Perplexity',        hasQuery: 'slug' },
  { match: 'chatgpt.com',        platform: 'ChatGPT',           hasQuery: false  },
  { match: 'chat.openai.com',    platform: 'ChatGPT',           hasQuery: false  },
  { match: 'claude.ai',          platform: 'Claude',            hasQuery: false  },
  { match: 'grok.com',           platform: 'Grok',              hasQuery: false  },
  { match: 'x.com',              platform: 'Grok',              hasQuery: false  },
  { match: 'gemini.google.com',  platform: 'Gemini',            hasQuery: false  },
  { match: 'you.com',            platform: 'You.com AI',        hasQuery: 'q'    },
  { match: 'kimi.moonshot.cn',   platform: 'Kimi',              hasQuery: false  },
  { match: 'mistral.ai',         platform: 'Mistral',           hasQuery: false  },
  { match: 'copilot.microsoft.com', platform: 'Copilot',        hasQuery: false  },
  // Google and Bing — query available but includes non-AI traffic
  { match: 'google.com',         platform: 'Google',            hasQuery: 'q'    },
  { match: 'bing.com',           platform: 'Bing',              hasQuery: 'q'    },
];

function detectAIReferrer(referer) {
  if (!referer) return null;

  let url;
  try { url = new URL(referer); }
  catch { return null; }

  const hostname = url.hostname.toLowerCase();

  for (const entry of AI_REFERRER_PLATFORMS) {
    if (hostname.includes(entry.match)) {
      const query = extractQuery(url, entry.hasQuery);
      return {
        platform: entry.platform,
        referrerUrl: referer,
        query,
      };
    }
  }

  return null;
}

function extractQuery(url, hasQuery) {
  if (!hasQuery) return null;

  // Standard ?q= parameter (Google, Bing, You.com)
  if (hasQuery === 'q') {
    const q = url.searchParams.get('q');
    return q ? decodeURIComponent(q).trim() : null;
  }

  // Perplexity slug: /search/{query-words}-{randomId}
  // Example: /search/best-isa-platform-uk-2024-AbCdEfGhIjKlMnOp
  if (hasQuery === 'slug') {
    const match = url.pathname.match(/\/search\/(.+)/);
    if (match) {
      const slug = match[1];
      // Random IDs are typically 12+ alphanumeric chars at the end
      const cleaned = slug
        .replace(/-[A-Za-z0-9]{12,}$/, '') // remove trailing random ID
        .replace(/-/g, ' ')                  // hyphens to spaces
        .trim();
      return cleaned || null;
    }
  }

  return null;
}

module.exports = { detectAIReferrer };
