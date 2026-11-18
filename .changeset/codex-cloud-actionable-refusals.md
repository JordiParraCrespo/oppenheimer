---
"@oppenheimer/runner": patch
"@oppenheimer/api": patch
"@oppenheimer/web": patch
"@oppenheimer/translations": patch
"@oppenheimer/shared": patch
"@oppenheimer/frontend-consumer": patch
---

Codex cloud sessions start on Codex's current cloud: in Codex's default
environment with the repository, or in an environment id pasted from ChatGPT
Settings → Codex Cloud. The environment picker no longer asks the host for a
list of legacy environments (`GET /v1/hosts/:id/codex-environments` and its
codes `SESSIONS_044`–`047` and `055` are gone); it offers Default and the id
you paste. A host whose codex is not signed in to ChatGPT refuses the start
with `SESS_022`.
