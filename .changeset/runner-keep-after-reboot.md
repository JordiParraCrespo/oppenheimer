---
"@oppenheimer/runner": minor
---

A kept session comes back on its own after the host reboots. `runner
sessions keep [<id>] [--off]` (or `runner sessions run --keep` for a child)
marks it; when the runner starts on a host that booted after it last saved
the session map, each kept session that was running is restarted once the
refresh finds it stopped, which reopens its agent's conversation in the
same checkout and never runs its first task again. A restart that fails is
retried with herdr-core's backoff (1.5 s doubling to a minute, then every
minute). A session whose agent exited, or that someone stopped or closed,
stays as it was left.
