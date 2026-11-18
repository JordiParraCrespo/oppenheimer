---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
---

A session's sidebar row turns blue when its agent's turn ends, and goes back to plain once you open the session. The API reads a turn's end off the agent's observed state (working or blocked, then at its prompt) and records it as the session's report, so the session is `ready-for-review` until it is read; `POST /sessions/:id/report/acknowledge` reads it, and the console calls it while the session is open and its tab is in front. Until now nothing wrote a report, so no session ever turned blue. No runner release is needed.
