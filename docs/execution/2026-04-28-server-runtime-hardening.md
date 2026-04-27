# Server Runtime Hardening

## Status

Implemented and verified. Pending commit.

## Goal

Improve the robustness of the lightweight SecretRoy sync server for a weak
single-machine deployment without introducing clustering, a database service, or
extra infrastructure.

The focus is operational safety: bad runtime paths, oversized vault files,
interrupted writes, stale temporary files, permissive runtime defaults that need
configuration hooks, slow or half-open HTTP connections, and unnecessary
dependency surface.

## Scope

Included:

- Runtime data directory resolution and startup writability checks.
- Maximum stored vault JSON file size guard before parsing and before writing.
- More durable atomic vault writes using temporary files, `fsync`, and `.bak`
  recovery.
- Startup cleanup for stale `vault_*.json.<pid>.tmp` files.
- Optional CORS origin allowlist through `CORS_ORIGIN`.
- Bounded Node HTTP request, header, keep-alive, and graceful shutdown timeouts.
- Cleanup of unused `sqlite3` and `ws` dependencies.
- `.gitignore` encoding cleanup.
- README updates and focused tests.

Out of scope:

- Cluster coordination.
- External database migration.
- Authentication or authorization model changes.
- Protocol shape changes for existing sync and pairing routes.

## Changes

Code:

- Added `DATA_DIR` support with path normalization.
- Added data directory existence, directory type, and write-probe validation.
- Added `MAX_VAULT_FILE_BYTES` with read and write enforcement.
- Preserved optimistic concurrency behavior for vault pushes.
- Added durable temporary-file writes and best-effort directory fsync.
- Added stale temporary vault file cleanup on app creation.
- Added configurable CORS middleware while keeping the unset development default
  permissive.
- Added server timeout configuration through `REQUEST_TIMEOUT_MS`,
  `HEADERS_TIMEOUT_MS`, `KEEP_ALIVE_TIMEOUT_MS`, and `SHUTDOWN_TIMEOUT_MS`.
- Made shutdown idempotent to avoid duplicate signal handling.

Tests:

- Added oversized vault read rejection.
- Added oversized vault write rejection and HTTP `413` route coverage.
- Added stale temporary file cleanup behavior.
- Added data path type validation.
- Added HTTP timeout configuration behavior.

Docs:

- Updated `README.md` with new environment variables, limits, and hardening
  notes.
- Added this execution record under `docs/execution/`.
- Added `docs/execution/README.md` as the ongoing execution-record convention.

Dependencies:

- Removed unused `sqlite3` and `ws` from `package.json` and `package-lock.json`.
- Ran `npm prune --ignore-scripts` so local `node_modules` matches the manifest.

Repository hygiene:

- Rewrote `.gitignore` as normal text after detecting embedded NUL bytes.

## Validation

Commands run:

```bash
node --test
npm.cmd test
git diff --check
npm.cmd ls --depth=0
```

Results:

- `node --test`: 26 tests passed.
- `npm.cmd test`: 26 tests passed.
- `git diff --check`: no whitespace errors; only Windows CRLF conversion
  warnings.
- `npm.cmd ls --depth=0`: only `cors`, `express`, and `nodemon` remain.

Note: `npm.cmd test` initially failed inside the normal sandbox with
`spawn EPERM`; rerunning with the approved elevated command succeeded.

## Risk Notes

- The default `MAX_VAULT_FILE_BYTES` is `128mb`, which is intentionally much
  larger than normal encrypted sync payloads but still protects the process from
  parsing unexpectedly large JSON files.
- `CORS_ORIGIN` is optional. When unset, the server remains permissive for local
  development and mobile testing.
- Directory fsync is best-effort because platform support differs. File fsync is
  still applied to the temporary payload before rename.
- Dependency removal is safe for the current codebase because neither `sqlite3`
  nor `ws` is imported by server code or tests.

## Follow-ups

- Add one execution record for every future feature, security improvement, or
  hardening pass.
- If this server becomes Internet-facing, add an explicit deployment guide for
  reverse proxy TLS, origin allowlists, and process supervision.
- Consider a small `/healthz` persistence check mode if operational monitoring
  needs to detect data directory failures after startup.
