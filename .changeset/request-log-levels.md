---
"@oppenheimer/backend-core": minor
"@oppenheimer/api": patch
"@oppenheimer/web": patch
---

Logs say more with less. A request's line takes its level from its status
(4xx `warn`, 5xx `error`) and carries the problem's `errorCode`; a
successful health or readiness probe is not logged; every line's text is
`msg`, never `message`; Nest's boot listing of modules and routes is at
`debug` (`QuietBootLogger`); and the middleware routes are written as
`{*splat}`, so Nest no longer warns about `/api/*` at every start. The
console's nginx keeps its own healthcheck out of the access log and holds a
request body up to 1 MiB in memory instead of warning about a temp file.
