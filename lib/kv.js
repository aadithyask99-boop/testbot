// ============================================================
// KV DATABASE HELPER
// ============================================================
// Plain English: This is the single file that talks to
// Upstash Redis. Every other file uses these functions
// rather than calling the database directly.
//
// Uses the REST API with fetch() — no npm package needed.
// Falls back gracefully if database is unreachable so the
// publisher's page never breaks due to a database issue.
// ============================================================

const BASE_URL = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function kvRequest(command) {
  if (!BASE_URL || !TOKEN) {
    throw new Error('KV environment variables not set');
  }
  const response = await fetch(`${BASE_URL}/${command.join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await response.json();
  return data.result;
}

// GET a value
async function kvGet(key) {
  try {
    return await kvRequest(['GET', encodeURIComponent(key)]);
  } catch (e) {
    console.error('KV GET error:', e.message);
    return null;
  }
}

// SET a value (with optional TTL in seconds)
async function kvSet(key, value, ttl = null) {
  try {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(JSON.stringify(value));
    if (ttl) {
      return await kvRequest(['SET', encodedKey, encodedValue, 'EX', ttl]);
    }
    return await kvRequest(['SET', encodedKey, encodedValue]);
  } catch (e) {
    console.error('KV SET error:', e.message);
    return null;
  }
}

// INCREMENT a counter
async function kvIncr(key) {
  try {
    return await kvRequest(['INCR', encodeURIComponent(key)]);
  } catch (e) {
    console.error('KV INCR error:', e.message);
    return null;
  }
}

// PUSH to a list (keep last N items)
async function kvListPush(key, value, maxLength = 100) {
  try {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(JSON.stringify(value));
    await kvRequest(['LPUSH', encodedKey, encodedValue]);
    await kvRequest(['LTRIM', encodedKey, '0', String(maxLength - 1)]);
    return true;
  } catch (e) {
    console.error('KV LPUSH error:', e.message);
    return null;
  }
}

// GET a list
async function kvListGet(key, count = 20) {
  try {
    const result = await kvRequest([
      'LRANGE',
      encodeURIComponent(key),
      '0',
      String(count - 1),
    ]);
    if (!result) return [];
    return result.map(item => {
      try { return JSON.parse(decodeURIComponent(item)); }
      catch { return item; }
    });
  } catch (e) {
    console.error('KV LRANGE error:', e.message);
    return [];
  }
}

module.exports = { kvGet, kvSet, kvIncr, kvListPush, kvListGet };
