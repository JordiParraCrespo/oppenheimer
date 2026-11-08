---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/runner": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
---

A failed session start can be tried again. The start pane's **Try again**
sends the host the same start, for the same session and with the same task
(`POST /v1/sessions/{id}/retry`, `SESSIONS_052` for a session whose start did
not fail), and draws the new attempt in place. A host whose Claude Code is not
signed in to claude.ai refuses a cloud start with `SESS_019`, which the pane
explains; the CLI's own words reach the console without its terminal escapes
and with their spaces.
