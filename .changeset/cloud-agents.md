---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Cloud agents: coding agents run in Cursor's cloud on the person's own Cursor
key (`product/next-steps/cloud-agents.md`).

- `@oppenheimer/shared`: `CLOUD_AGENT_PROVIDERS`, `CLOUD_AGENT_STATUSES`, the
  launch, follow-up and credential schemas, the `CloudAgent` subject and the
  `cloud-agents` scopes.
- `@oppenheimer/api`: the `cloud-agents` module (`cloud_agent`,
  `cloud_agent_credential`) behind `/v1/cloud-agents`: the status, a key
  checked with Cursor and stored sealed under `CLOUD_AGENTS_KEY`, its models
  and repositories, launch, one agent and the list read through to Cursor on
  a budget, follow-up and stop; `CLOUD_AGENTS_001`–`011`.
- `@oppenheimer/api-client`: the cloud agent operations.
- `@oppenheimer/frontend-consumer`: the `cloudAgents` module and its hooks,
  a `cloudAgent` poll, kept out of the persisted cache.
- `@oppenheimer/web`: a Cloud agents rail item (launch, the agents, one
  agent's page with Stop and its next instruction) and Settings → Cloud agents.
