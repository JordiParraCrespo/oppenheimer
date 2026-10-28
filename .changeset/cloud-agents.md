---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Cloud sessions: a session can run in Cursor's cloud on the person's own
Cursor key, chosen in New session's place picker
(`product/next-steps/cloud-agents.md`).

- `@oppenheimer/shared`: the `cloud` session place, `HOST_SESSION_PLACES`,
  `SESSION_AGENT_IDS`, `startCloudSessionSchema`, `CLOUD_AGENT_IDS` and the
  credential schemas, the `CloudAgent` subject and the `cloud-agents` scopes.
- `@oppenheimer/api`: `POST /v1/sessions/cloud`; a cloud session is a
  `work_session` with no host and a `session_cloud_run`, its vendor status
  folded into its log and synced on read within Cursor's budget; host-only
  commands refuse it with `SESSIONS_036`. The `cloud-agents` module keeps the
  sealed key (`cloud_agent_credential`, `CLOUD_AGENTS_KEY`), the status, the
  models and repositories, and publishes `CLOUD_RUNS` to sessions.
- `@oppenheimer/api-client`: `startCloudSession` and a session's `cloud`.
- `@oppenheimer/frontend-consumer`: a session's `cloud`, `useStartCloudSession`,
  a `cloudSession` poll, the slimmed `cloudAgents` module.
- `@oppenheimer/web`: Cloud in the place picker, Cursor in the agent picker,
  cloud rows in the sidebar that open Cursor, a cloud session's page, and
  Settings → Cloud agents.
