---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
---

A session's changes can be read off its host, for the Review that comes next.

- `@oppenheimer/shared`: the link gains `session.changes.read` and `session.changes`, gated on the `session.changes.read` capability, with their bounds; `sessionChangesResponseSchema` is the API's answer.
- `@oppenheimer/runner`: answers `session.changes.read` with git over each checkout: every file changed since the branch left its base (or only what is not committed yet), untracked files included, with counts and patches kept under the link's frame.
- `@oppenheimer/api`: `GET /v1/sessions/:id/changes?scope=base|uncommitted`, owner only (`sessions:read`); a host with no link or a runner without the capability is a state, no answer in 15s `SESSIONS_031`.
- `@oppenheimer/api-client`: `findSessionChanges`.
