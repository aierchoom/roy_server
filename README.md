# SecretRoy Sync Server

Small single-process sync and pairing server for SecretRoy development and
lightweight self-hosting. It intentionally stays simple: JSON files on local
disk, no clustering, no external database, and opaque encrypted client payloads.

## Run

```bash
npm install
npm start
```

Optional environment:

- `PORT`: listen port, default `8080`
- `RATE_LIMIT_MAX`: requests per client per window, default `600`; set `0` to
  disable
- `RATE_LIMIT_WINDOW_MS`: rate-limit window in milliseconds, default `60000`

Runtime vault files are written under `data/`, which is ignored by git.

## API

- `GET /healthz`
  - Returns `{ ok: true, status: "healthy" }`.
- `GET /vaults/:vaultId/sync?since=<version>`
  - Returns vault changes newer than `since`, or `304` if unchanged.
- `POST /vaults/:vaultId/sync`
  - Accepts `{ pushes: [...] }`.
  - Applies optimistic concurrency by checking each item's
    `expected_base_version`.
- `POST /pairing/sessions`
  - Creates a short-lived pairing session for a trusted host device.
- `POST /pairing/sessions/join`
  - Lets a requester claim a pairing code.
- `GET /pairing/sessions/:sessionId`
  - Lets the host poll pending requester details.
- `POST /pairing/sessions/:sessionId/approve`
  - Lets the host approve or reject the pending requester.
- `GET /pairing/sessions/:sessionId/bundle`
  - Lets the approved requester fetch the wrapped vault bundle.

## Limits

- JSON body size: `5mb`
- Push batch size: `200` items
- Per-item encrypted payload size: `1mb`
- Stored vault item count: `10000`
- Wrapped pairing bundle size: `64kb`
- Pairing TTL: clamped between `60s` and `30m`, default `10m`
- Active pairing sessions: `500`
- Per-process request rate limit: `600` requests per minute per client

## Hardening Notes

- Vault ids, item ids, and device ids accept only `[A-Za-z0-9_-]`.
- Vault writes are atomic and use a `.bak` file for recovery.
- Stored vault documents are normalized on load; malformed documents surface as
  `503` persistence errors instead of partial reads.
- Pairing codes use the readable alphabet
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` and reject ambiguous characters.
- All mutation requests must use `Content-Type: application/json`.
- API responses include conservative headers such as `Cache-Control: no-store`,
  `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
- Express `X-Powered-By` is disabled.
- Every response includes `X-Request-Id`; clients may provide a safe
  `X-Request-Id` for tracing.
- A simple in-memory rate limiter protects a single weak server from accidental
  request floods. Set `maxRequestsPerWindow <= 0` in `createApp(...)` tests to
  disable it.
- `SIGINT` and `SIGTERM` trigger graceful server shutdown with a short force
  timeout.

## Tests

```bash
npm test
```

The test suite covers vault persistence recovery, conflict classification,
request validation, pairing lifecycle, malformed body handling, and security
headers.
