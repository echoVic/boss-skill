# api-auth-demo

> **Demo only.** This is a Boss Skill example illustrating how to scaffold a tiny
> Express service with API-key authentication. Do not use the bundled keys or
> patterns verbatim in production.

A minimal Express service with an `X-API-Key` header middleware. Keys come from
the `API_KEYS` env var (comma-separated). `/health` is whitelisted; `/protected`
requires a valid key.

## Run

```bash
cd examples/api-auth
npm install
API_KEYS="secret-key-1,another-secret-2" npm start
```

## Try it

```bash
# whitelist
curl -s localhost:3000/health
# {"status":"ok"}

# missing key
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/protected
# 401

# valid key
curl -s -H "X-API-Key: secret-key-1" localhost:3000/protected
# {"ok":true,"message":"authorized"}
```

## Test

```bash
npm test
```

## Layout

```
src/
  auth.js     # createApiKeyAuth({ keys, whitelist, headerName })
  server.js   # createApp({ keys }) + bootstrap from env
test/
  auth.test.js
```

## Design notes

- Key comparison uses `crypto.timingSafeEqual` with length-padded buffers so the
  loop body runs in constant time relative to the configured keys.
- The middleware is a **factory** — keys are passed in, not read from globals —
  so tests can construct an app with a known key set.
- `server.js` refuses to start if `API_KEYS` is empty: silent open-by-default is
  worse than a loud crash.
