'use strict';

const express = require('express');
const { createApiKeyAuth } = require('./auth');

/**
 * Build the Express app. Exported as a factory so tests can construct it with
 * a specific keys list rather than relying on env state.
 */
function createApp({ keys } = {}) {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(createApiKeyAuth({ keys }));

  app.get('/protected', (_req, res) => {
    res.json({ ok: true, message: 'authorized' });
  });

  return app;
}

function parseKeysFromEnv(raw) {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

if (require.main === module) {
  const keys = parseKeysFromEnv(process.env.API_KEYS);
  if (keys.length === 0) {
    console.error('API_KEYS env is required (comma-separated). Refusing to start.');
    process.exit(1);
  }
  const port = Number(process.env.PORT) || 3000;
  createApp({ keys }).listen(port, () => {
    console.log(`api-auth-demo listening on :${port}`);
  });
}

module.exports = { createApp, parseKeysFromEnv };
