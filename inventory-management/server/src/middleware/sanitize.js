/**
 * Defence-in-depth against NoSQL operator injection: removes keys that start with "$"
 * or contain "." from body and params, and flattens query-string values to plain strings.
 */
function clean(value, depth = 0) {
  if (depth > 20) return undefined;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = clean(v, depth + 1);
    }
    return out;
  }
  return value;
}

function flattenQuery(query) {
  const out = {};
  for (const [k, v] of Object.entries(query || {})) {
    if (k.startsWith('$') || k.includes('.')) continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val === undefined || val === null || typeof val === 'object') continue;
    out[k] = String(val);
  }
  return out;
}

module.exports = function sanitize(req, res, next) {
  if (req.body) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  req.query = flattenQuery(req.query);
  next();
};
