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
    // Values are stored as JSON strings — parse them back into objects
    try { return JSON.parse(decodeURIComponent(result)); }
    catch { return result; }
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

module.exports = { kvGet, kvSet, kvIncr, kvListPush, kvListGet, kvJsonUpdate, kvHashIncr, kvHashGetAll };
