# Sync Server Usability Direction

| Item | Value |
|---|---|
| Status | Documented |
| Date | 2026-04-28 |
| Scope | Documentation, product direction |
| Related Docs | [README](../../README.md) |

## Goal

Document the current direction for improving the SecretRoy sync server as an easy personal/self-hosted appliance rather than a complex production platform.

## Scope

Included:

- First-run setup direction.
- Diagnostics direction.
- Backup and migration direction.
- Weak-server/self-hosting usability direction.

Out of scope:

- Cluster deployment.
- Managed hosting.
- External database migration.
- Team or enterprise governance.

## Changes

- Added a `Usability Direction` section to the server README.
- Added the current conclusion that the server is an optional sync helper for a local-first vault.
- Clarified that server usability should prioritize simple startup, inspectability, safe backup, and machine replacement.
- Clarified that diagnostics must remain secret-safe and never print vault payloads, pairing bundles, or client secrets.

## Validation

- Documentation-only change.
- Reviewed the README section for alignment with the current lightweight server architecture.

## Risk Notes

- This does not implement new server behavior yet.
- Future implementation should keep the server lightweight and avoid adding operational complexity before the first-run path is clear.

## Follow-Ups

- Add `.env.example` and copyable startup examples.
- Add safe diagnostics endpoint or command output.
- Add backup and migration guide for `DATA_DIR`.
- Add client-side server URL validation and health-check UX.
