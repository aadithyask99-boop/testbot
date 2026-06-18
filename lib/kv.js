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
    const result = await kvRequest(['GET', encodeURIComponent(key)]);
    if (result === null || result === undefined) return null;
    if (typeof result !== 'string') return result;

    // Values are stored via kvSet as encodeURIComponent(JSON.stringify(value)).
    // BUT: decodeURIComponent throws "URI malformed" on a string containing a
    // bare '%' not followed by two valid hex digits — and plain JSON (e.g.
    // ad copy containing "0.15%") triggers this if Upstash's REST GET ever
    // returns the value already decoded (observed for some keys). Previously
    // the catch fell through to `return result` (the raw JSON STRING), which
    // callers then spread with {...c}, producing a character-indexed object
    // ({"0":"{","1":"\"",...}) — the Session 5 corrupted-campaign bug.
    //
    // Fix: try JSON.parse on the raw result FIRST (covers the "already
    // decoded" case). Only attempt decodeURIComponent if that fails, for
    // genuinely double-encoded values. If both fail, return the raw string
    // (old behaviour, for non-JSON values like session tokens).
    try {
      return JSON.parse(result);
    } catch { /* not plain JSON — try decoding */ }

    try {
      return JSON.parse(decodeURIComponent(result));
    } catch { /* not URL-encoded JSON either — return as-is */ }

    return result;
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

// SET with explicit TTL in seconds — clearer intent than kvSet(key, value, ttl).
// Used by the matching layer (Session 3) to cache page classifications for 24h.
async function kvSetWithTTL(key, value, ttlSeconds) {
  return kvSet(key, value, ttlSeconds);
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

// UPDATE a JSON object stored in KV (read-modify-write)
// Safe for low-concurrency use — testing dashboard only
async function kvJsonUpdate(key, updateFn) {
  try {
    const current = await kvGet(key) || {};
    const updated = updateFn(current);
    await kvSet(key, updated);
    return updated;
  } catch (e) {
    console.error('KV JSON update error:', e.message);
    return null;
  }
}


// Atomically increment a field in a Redis HASH
// Unlike kvJsonUpdate, this is race-condition safe
// INCRBY — atomic integer increment by N. Used for revenue tracking in pence.
// Store pounds as integer pence (multiply by 100 before storing, divide on read).
async function kvIncrBy(key, amount) {
  try {
    return await kvRequest(['INCRBY', encodeURIComponent(key), String(Math.round(amount))]);
  } catch (e) {
    console.error('KV INCRBY error:', e.message);
    return null;
  }
}

async function kvHashIncr(hashKey, field) {
  try {
    return await kvRequest([
      'HINCRBY',
      encodeURIComponent(hashKey),
      encodeURIComponent(field),
      '1'
    ]);
  } catch (e) {
    console.error('KV HINCRBY error:', e.message);
    return null;
  }
}

// Get all fields and values from a Redis HASH
async function kvHashGetAll(hashKey) {
  try {
    const result = await kvRequest(['HGETALL', encodeURIComponent(hashKey)]);
    if (!result || !Array.isArray(result)) return {};
    // HGETALL returns flat array: [field1, value1, field2, value2, ...]
    const obj = {};
    for (let i = 0; i < result.length; i += 2) {
      obj[decodeURIComponent(result[i])] = parseInt(result[i + 1]) || 0;
    }
    return obj;
  } catch (e) {
    console.error('KV HGETALL error:', e.message);
    return {};
  }
}

// DELETE a key
async function kvDel(key) {
  try {
    return await kvRequest(['DEL', encodeURIComponent(key)]);
  } catch (e) {
    console.error('KV DEL error:', e.message);
    return null;
  }
}

module.exports = { kvGet, kvSet, kvSetWithTTL, kvIncr, kvIncrBy, kvListPush, kvListGet, kvJsonUpdate, kvHashIncr, kvHashGetAll, kvDel };
