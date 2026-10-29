---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/runner': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
'@oppenheimer/docs': patch
---

A bot can watch what a session's terminal prints. `watch_session` takes a
`pattern`, which the runner matches line by line on the host (new
`session.watch` / `session.unwatch` commands and the `terminal.matched`
event, which carries only a count). The match wakes the bot once per new
count, and the chat shows "Session “X” printed 3 lines matching “FAIL”". A
wake for a task that ended says when its pattern never matched. Two more
tools land with it. `wait_for_session` waits up to 120 s inside a turn.
`read_session` takes `after_seq`, which `send_to_session` and
`answer_session` now hand back, so a bot reads only what followed its own
input. A watch sent again on a hello carries its last count, so a runner
that restarted counts on from it. New errors are `SESSIONS_042` (invalid pattern), `SESSIONS_043`
(10 patterns per session) and the runner's `INVALID_PATTERN`.
