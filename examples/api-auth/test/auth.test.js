'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp, parseKeysFromEnv } = require('../src/server');
const { createApiKeyAuth } = require('../src/auth');

const KEYS = ['secret-key-1', 'another-secret-2'];

test('factory rejects empty keys list', () => {
  assert.throws(() => createApiKeyAuth({ keys: [] }), /non-empty/);
  assert.throws(() => createApiKeyAuth({}), /non-empty/);
});

test('parseKeysFromEnv trims and filters', () => {
  assert.deepEqual(parseKeysFromEnv(' a , b ,, c '), ['a', 'b', 'c']);
  assert.deepEqual(parseKeysFromEnv(''), []);
  assert.deepEqual(parseKeysFromEnv(undefined), []);
});

test('GET /health bypasses auth (whitelist)', async () => {
  const app = createApp({ keys: KEYS });
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('GET /protected without header → 401 missing_api_key', async () => {
  const app = createApp({ keys: KEYS });
  const res = await request(app).get('/protected');
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'missing_api_key' });
});

test('GET /protected with wrong key → 401 invalid_api_key', async () => {
  const app = createApp({ keys: KEYS });
  const res = await request(app).get('/protected').set('X-API-Key', 'nope-not-it');
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'invalid_api_key' });
});

test('GET /protected with correct key → 200 authorized', async () => {
  const app = createApp({ keys: KEYS });
  const res = await request(app).get('/protected').set('X-API-Key', KEYS[0]);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, message: 'authorized' });
});

test('GET /protected with second valid key also passes', async () => {
  const app = createApp({ keys: KEYS });
  const res = await request(app).get('/protected').set('X-API-Key', KEYS[1]);
  assert.equal(res.status, 200);
});

test('over-length wrong key → 401 invalid_api_key (no crash)', async () => {
  const app = createApp({ keys: KEYS });
  const res = await request(app).get('/protected').set('X-API-Key', 'x'.repeat(1024));
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'invalid_api_key' });
});
