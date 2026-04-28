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
- `DATA_DIR`: runtime vault directory, default `./data`
- `MAX_VAULT_FILE_BYTES`: max stored JSON vault file size, default `134217728`
- `RATE_LIMIT_MAX`: requests per client per window, default `600`; set `0` to
  disable
- `RATE_LIMIT_WINDOW_MS`: rate-limit window in milliseconds, default `60000`
- `REQUEST_TIMEOUT_MS`: max request lifetime, default `30000`
- `HEADERS_TIMEOUT_MS`: max time to receive request headers, default `10000`
- `KEEP_ALIVE_TIMEOUT_MS`: idle keep-alive timeout, default `5000`
- `SHUTDOWN_TIMEOUT_MS`: graceful shutdown force timeout, default `5000`
- `CORS_ORIGIN`: optional comma-separated browser origin allowlist

Runtime vault files are written under `DATA_DIR`; the default `data/` directory
is ignored by git.

## Usability Direction

The sync server should feel like a small personal appliance: simple to start,
easy to inspect, safe to back up, and replaceable when the user moves machines.
It should not require cluster operations, external databases, or a managed
platform to be useful.

Current conclusion:

- The server is an optional sync helper for a local-first vault.
- It should make self-hosting feel approachable on a personal machine, NAS, or
  small VPS.
- It should stay opaque to secrets and never become the source of plaintext
  truth.
- Its first usability wins should be setup guidance, diagnostics, backup,
  migration, and client health-check clarity.

Near-term usability goals:

- Provide a clear first-run path: choose `DATA_DIR`, start the server, see the
  listen URL, check `/healthz`, connect the client, and confirm first sync.
- Add copyable setup examples for local machine, LAN machine, NAS, and small VPS
  usage without changing the server architecture.
- Make diagnostics actionable: data directory path, writability, vault file
  count, configured limits, request timeouts, rate-limit state, and recent
  persistence errors.
- Make backup and migration obvious: stop server, copy `DATA_DIR`, start server
  with the same `DATA_DIR`, then verify health from a client.
- Keep secrets opaque: diagnostics can explain storage and runtime state, but
  must not print vault payload contents, pairing bundles, or client secrets.
- Prefer simple scripts and `.env` examples before adding heavier packaging.

## Source Layout

- `index.js`: process entrypoint and compatibility exports for tests/tools.
- `system/config.js`: environment-backed runtime constants.
- `system/app.js`: Express app assembly and route registration.
- `system/server.js`: HTTP server startup, timeouts, and shutdown handling.
- `system/routes/`: route modules grouped by API domain; larger domains use
  subfolders with one endpoint flow per file.
- `system/vault/`: vault directory checks, paths, document normalization, file
  limits, atomic writes, recovery, and temp-file cleanup.
- `system/sync/`: since-version parsing, push validation, conflict
  classification, and optimistic concurrency state transitions.
- `system/pairing/`: pairing TTL, codes, session store, authorization checks,
  and timestamp formatting.
- `system/http/`: request IDs, security headers, CORS, rate limiting, body
  validation, logging, and error responses.

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
  - Lets a requester claim a pairing code with `requester_public_key`.
- `GET /pairing/sessions/:sessionId`
  - Lets the host poll pending requester details, including the temporary
    requester public key.
- `POST /pairing/sessions/:sessionId/approve`
  - Lets the host approve or reject the pending requester. Approved bundles
    must use the encrypted `sroy-pairing-v2:` format.
- `GET /pairing/sessions/:sessionId/bundle`
  - Lets the approved requester fetch the wrapped vault bundle.

## Limits

- JSON body size: `5mb`
- Push batch size: `200` items
- Per-item encrypted payload size: `1mb`
- Stored vault item count: `10000`
- Stored JSON vault file size: `128mb`
- Wrapped pairing bundle size: `64kb`
- Pairing TTL: clamped between `60s` and `30m`, default `10m`
- Active pairing sessions: `500`
- Per-process request rate limit: `600` requests per minute per client

## Hardening Notes

- Vault ids, item ids, and device ids accept only `[A-Za-z0-9_-]`.
- The runtime data directory is created on startup and verified as writable.
- Vault writes are atomic, fsynced, and use a `.bak` file for recovery.
- Stale `vault_*.json.<pid>.tmp` files are cleaned during startup.
- Oversized vault files are rejected before parsing to avoid memory spikes.
- Stored vault documents are normalized on load; malformed documents surface as
  `503` persistence errors instead of partial reads.
- Pairing codes use the readable alphabet
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` and reject ambiguous characters.
- Server-mediated pairing requires the requester to publish a temporary public
  key, and approval rejects plaintext `sroy-link-v1:` transfer bundles.
- All mutation requests must use `Content-Type: application/json`.
- API responses include conservative headers such as `Cache-Control: no-store`,
  `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
- Express `X-Powered-By` is disabled.
- Every response includes `X-Request-Id`; clients may provide a safe
  `X-Request-Id` for tracing.
- A simple in-memory rate limiter protects a single weak server from accidental
  request floods. Set `maxRequestsPerWindow <= 0` in `createApp(...)` tests to
  disable it.
- Browser CORS can be restricted with `CORS_ORIGIN`; when unset, the development
  default remains permissive.
- The Node HTTP server sets bounded request, header, keep-alive, and shutdown
  timeouts for slow or half-open connections.
- `SIGINT` and `SIGTERM` trigger graceful server shutdown with a short force
  timeout.

Detailed feature execution records live in
[`docs/execution/`](docs/execution/). Add one Markdown file there for every
feature, security improvement, or runtime hardening pass.

## Tests

```bash
npm test
```

The test suite covers vault persistence recovery, size limits, stale temp
cleanup, conflict classification, request validation, pairing lifecycle,
malformed body handling, HTTP timeouts, and security headers.
