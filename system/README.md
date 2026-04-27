# System Modules

`system/` contains server implementation files grouped by responsibility.

- `app.js`: Express app assembly only.
- `server.js`: process-facing HTTP server startup and shutdown only.
- `config.js`: environment-backed constants only.
- `options.js`: environment option parsing only.
- `errors.js`: shared error classes only.
- `logger.js`: logger dispatch helper only.
- `ids.js`: random id helpers only.
- `validation.js`: shared input validation only.
- `vault/`: vault directory, path, document, file-limit, atomic-write,
  persistence, recovery, and temp-file cleanup modules.
- `sync/`: since-version, push-validation, conflict, and state-transition
  modules.
- `pairing/`: pairing TTL, code, session store, authorization, and timestamp
  modules.
- `http/`: request id, security header, CORS, rate-limit, JSON body,
  request-log, and error-response modules.
- `routes/`: API route modules grouped by route domain; large domains should
  use subfolders with one endpoint flow per file.

New implementation files should go here by default. Keep `index.js` as the
thin entrypoint and public compatibility export surface.
