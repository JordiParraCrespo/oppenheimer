---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/runner": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
---

Sessions in Codex's cloud, the way Claude Code's cloud works. New session's
Cloud tab has a *Codex* row beside *Claude Code*: a host that can starts the
task with its own `codex cloud exec` on the repository's base branch, in the
Codex environment named for the repository, and keeps nothing. Unlike
Claude Code's cloud, the host also follows it: the runner reads
`codex cloud list --json` once a minute while a task it started is
unsettled and reports it as the session's state (working, done, failed). The
pane offers *Open in ChatGPT* and `codex apply <id>`. Runner capability
`session.cloud.codex`; hosts say `startsCodexCloudSessions`; the runner's
`SESS_009` carries the CLI's own words when it refuses; `SESSIONS_038` now
names either vendor.
