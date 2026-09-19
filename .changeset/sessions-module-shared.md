---
"@oppenheimer/shared": minor
---

The query and body schemas the session routes validate against, and one
capability.

`session.schema.ts` gains `issueAttachTicketSchema`, `closeSessionSchema`,
`listSessionsQuerySchema` and `listSessionEventsQuerySchema` (a `seq` cursor,
because a page number over a growing log re-reads what it has already shown);
`project.schema.ts` gains `listProjectsQuerySchema`. `ENDPOINT_POLICIES` gains the
session destinations and the four write paths whose whole path is one action, and
`DEPLOYMENT_CAPABILITIES` gains `session_namer`, so "this deployment names
nothing" is answered by the startup log rather than by reading the naming code.
