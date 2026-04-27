# Feature Execution Records

This directory stores one execution record per feature or hardening task.

## Naming

Use this pattern:

```text
YYYY-MM-DD-feature-slug.md
```

Examples:

- `2026-04-28-server-runtime-hardening.md`
- `2026-05-02-pairing-rate-limit-tuning.md`

## Required Sections

Each execution document should include:

- `Status`: draft, implemented, verified, or committed.
- `Goal`: why this work exists.
- `Scope`: what is included and what is explicitly out of scope.
- `Changes`: code, docs, tests, config, or dependency changes.
- `Validation`: commands run and their result.
- `Risk Notes`: known risks, compatibility notes, or rollback notes.
- `Follow-ups`: intentionally deferred work.

## Update Rule

Every feature development, security improvement, or runtime hardening pass should
add one new Markdown file here before the work is considered complete. General
README files should link to these records instead of duplicating full execution
details.

## Records

| Date | Record | Scope |
|---|---|---|
| 2026-04-28 | [2026-04-28-server-runtime-hardening.md](2026-04-28-server-runtime-hardening.md) | Runtime hardening |
| 2026-04-28 | [2026-04-28-server-system-module-refactor.md](2026-04-28-server-system-module-refactor.md) | System module refactor |
| 2026-04-28 | [2026-04-28-sync-server-usability-direction.md](2026-04-28-sync-server-usability-direction.md) | Sync server usability direction |
