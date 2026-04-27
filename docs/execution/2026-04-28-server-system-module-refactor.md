# Server System Module Refactor

## Status

Implemented and verified. Pending commit.

## Goal

Apply the project code-organization rule that files should follow single
responsibility as much as possible, with implementation details grouped under a
`system/` folder.

The previous `index.js` file mixed configuration, validation, vault storage,
sync state transitions, pairing session logic, HTTP middleware, route handlers,
server startup, and public exports. This refactor keeps the external entrypoint
stable while moving responsibilities into focused modules.

## Scope

Included:

- Keep `index.js` as the process entrypoint and compatibility export surface.
- Move runtime constants into `system/config.js`.
- Move environment option parsing into `system/options.js`.
- Move domain errors into `system/errors.js`.
- Move shared logging into `system/logger.js`.
- Move random id helpers into `system/ids.js`.
- Move safe id validation into `system/validation.js`.
- Move vault file persistence into focused modules under `system/vault/`.
- Move sync conflict and push validation logic into focused modules under
  `system/sync/`.
- Move pairing session and pairing code rules into focused modules under
  `system/pairing/`.
- Move HTTP middleware and error-response behavior into focused modules under
  `system/http/`.
- Move API route registration into `system/routes/`.
- Move Express app assembly into `system/app.js`.
- Move server startup, timeout, and shutdown handling into `system/server.js`.
- Update README source layout documentation.
- Add a `system/README.md` responsibility map for future server changes.
- Split broad vault and HTTP modules into narrower submodules after the initial
  `system/` extraction.
- Split pairing helpers into narrower TTL, code, session store, authorization,
  and timestamp modules.
- Split sync helpers into narrower since-version, push-validation, conflict,
  and state-transition modules.
- Split pairing route handlers into one endpoint flow per file under
  `system/routes/pairing/`.

Out of scope:

- Behavior changes to sync, pairing, persistence, or rate limiting.
- Renaming public API routes.
- Changing test imports away from `index.js`.
- Introducing a build step or framework.

## Changes

Code:

- Replaced the monolithic `index.js` with a small entrypoint that starts the
  server when executed directly and re-exports the functions used by tests.
- Added `system/` modules grouped by one primary responsibility.
- Added `system/routes/system_routes.js`, `system/routes/vault_routes.js`, and
  `system/routes/pairing/*_route.js` files plus a registration index.
- Added `system/vault/` modules for directory handling, paths, document
  normalization, file limits, atomic JSON writes, persistence, and cleanup.
- Added `system/http/` modules for request IDs, security headers, CORS, rate
  limiting, JSON body checks, request logging, and error responses.
- Added `system/pairing/` modules for TTL parsing, pairing codes, session
  storage, ownership checks, and timestamp formatting.
- Added `system/sync/` modules for since-version parsing, push validation,
  conflict responses, and optimistic concurrency state transitions.
- Preserved existing CommonJS module style and no-build Node runtime.

Docs:

- Updated `README.md` with a source layout section.
- Added `system/README.md` with module responsibility rules.
- Added this execution record.

Tests:

- No test behavior was changed.
- Existing tests continue to call the public `index.js` export surface.

## Validation

Commands run:

```bash
node --test
npm.cmd test
git diff --check
```

Results:

- `node --test`: 26 tests passed after the split.
- `npm.cmd test`: 26 tests passed after the deeper `system/` split.
- `git diff --check`: no whitespace errors; only Windows CRLF conversion
  warnings.

## Risk Notes

- The refactor intentionally keeps public exports in `index.js` to reduce churn
  for tests and local tooling.
- Route behavior is preserved by moving handlers without changing paths,
  response shapes, or validation messages.
- The new `system/` layout makes future feature execution records easier to map
  to touched responsibilities.

## Follow-ups

- Use `system/` for future server implementation files by default.
- Add new route modules by API domain instead of appending to `index.js`.
- Consider direct unit tests for selected `system/` modules if future changes
  make a module more complex than the current route-level coverage.
