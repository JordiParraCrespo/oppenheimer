---
'@oppenheimer/api': patch
'@oppenheimer/shared': patch
'@oppenheimer/translations': patch
---

A bot's routine no longer wakes for a pull request its own session opened.
A session opens its pull request and pushes with `gh` as the owner, so the
check for our own App's events let them through, and a routine such as
"review every new pull request" woke its bot to review its own work. If that
turn started another session, it looped until the hourly cap.

A session a bot starts now records that bot (`work_session.botId`). When a
GitHub event names a branch (pull request opened, pushed, merged, a check, a
review, a push), a routine whose bot started a session on that branch, a host
session's checkout or a cloud session's run, records the run as skipped,
`own_session_event`. A fork's pull request never counts as a bot's own. Other bots' routines and session
automations still fire, and a bot following its own pull request with
`watch_pull_request` still wakes.
