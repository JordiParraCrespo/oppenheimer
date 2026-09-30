---
"@oppenheimer/api": patch
---

A stopped session stops holding its host's automation slot.

Stopping a session ends its processes and leaves the worktree, so the lifecycle
deliberately does not move: it stays `open` with `stoppedAt` set, and can be
restarted. The automation guards counted it as live anyway, so every session
ever stopped on a host consumed one of that host's slots for good. Measured:
six stopped sessions filled a `liveRunsPerHost` of two, and every automation on
that host deferred for ever behind panes that had not existed for hours —
silently, because deferring is what a busy host is supposed to look like.

The guards now read `stoppedAt`. Nothing else changes: a live session counts as
it always did.
