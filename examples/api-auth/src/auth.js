'use strict';

const crypto = require('node:crypto');

/**
 * Create an Express middleware that enforces an `X-API-Key` header.
 *
 * @param {object} options
 * @param {string[]} options.keys       Non-empty list of accepted keys.
 * @param {string[]} [options.whitelist] Exact request paths that bypass auth. Default: ['/health'].
 * @param {string}   [options.headerName] Header to read (lowercase). Default: 'x-api-key'.
 * @returns {import('express').RequestHandler}
 */
function createApiKeyAuth({ keys, whitelist = ['/health'], headerName = 'x-api-key' } = {}) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('createApiKeyAuth: keys must be a non-empty string[]');
  }

  // Pre-encode accepted keys once. Pad to the max byte length so timingSafeEqual
  // can compare without short-circuiting on length.
  const encoded = keys.map((k) => Buffer.from(String(k), 'utf8'));
  const maxLen = encoded.reduce((m, b) => Math.max(m, b.length), 0);
  const padded = encoded.map((b) => Buffer.concat([b, Buffer.alloc(maxLen - b.length)]));
  const whitelistSet = new Set(whitelist);

  return function apiKeyAuth(req, res, next) {
    if (whitelistSet.has(req.path)) return next();

    const provided = req.header(headerName);
    if (!provided) {
      return res.status(401).json({ error: 'missing_api_key' });
    }

    const candidate = Buffer.from(String(provided), 'utf8');
    if (candidate.length > maxLen) {
      // Too long to match any configured key — still walk the loop so wall time
      // is comparable to an equal-length wrong key.
      let acc = 0;
      for (const k of padded) acc |= k[0] ^ candidate[0];
      void acc;
      return res.status(401).json({ error: 'invalid_api_key' });
    }
    const paddedCandidate = Buffer.concat([candidate, Buffer.alloc(maxLen - candidate.length)]);

    let matched = false;
    for (const k of padded) {
      if (crypto.timingSafeEqual(k, paddedCandidate)) matched = true;
    }
    if (!matched) {
      return res.status(401).json({ error: 'invalid_api_key' });
    }

    req.apiKey = provided;
    return next();
  };
}

module.exports = { createApiKeyAuth };
