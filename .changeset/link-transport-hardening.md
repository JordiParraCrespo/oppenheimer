---
"@oppenheimer/api": patch
"@oppenheimer/runner": patch
"@oppenheimer/web": patch
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-core": minor
---

Harden the runner link. PTY bytes are no longer dropped when a queue fills,
and the runner's writer sends control frames first, then takes attachments in
turn, so one pane's output no longer delays another pane's echo. Both sides
now ping every 15 s, a runner the control plane cannot write to is closed
rather than skipped, and epochs keep rising across API restarts. The
terminal's transport (`SessionStream`, the resize coalescer, the replay
stream) moves from `apps/web` into `@oppenheimer/frontend-consumer`, behind
`SessionsService.openStream` and `useSessionStream`.
