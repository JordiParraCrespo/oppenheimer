---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/runner': minor
'@oppenheimer/api-client': minor
'@oppenheimer/cli': minor
'@oppenheimer/mcp': minor
'@oppenheimer/web': patch
'@oppenheimer/translations': minor
---

Sessions: read a session's conversation, and message coding agents both ways.

- `GET /v1/sessions/{id}/transcript` (`sessions:read`) reads what a session's
  agent said and did, a page at a time off its host over the new
  `transcript.read` / `transcript.page` link messages, with an opaque cursor,
  secrets redacted, and a `status` (`complete`, `partial`, `unsupported`,
  `unavailable`) and `reason` on every page. A cloud session's conversation
  is `unsupported` with its vendor's link. Bots get `read_session_transcript`,
  MCP a tool of the same name, and `opp` `sessions transcript`.
- A Cursor cloud session takes a follow-up prompt (`send_to_session`,
  `POST /v1/sessions/{id}/prompt`) as a new run of its agent, on its
  launcher's key, only once its last run ended (`CLOUD_AGENTS_012` while
  Cursor says it is busy, `SESSIONS_050` for anyone but the launcher).
- An agent's `runner sessions notify` wakes every bot that follows its
  session, once per notice, the words fenced as the agent's.
