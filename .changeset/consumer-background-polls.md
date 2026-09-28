---
"@oppenheimer/frontend-consumer": patch
---

A poll that watches something finish keeps going while the tab is hidden.
TanStack Query pauses `refetchInterval` on a hidden document unless
`refetchIntervalInBackground` says otherwise, and nothing set it, so a session
started in a tab the reader then left came back frozen on a step that had
finished a minute before (#111). The session list, detail and start progress,
the automation list, detail, runs and run, and the two pairing polls now set
it; each already stops on its own once the thing settles. Host presence, the
one poll that never settles, stays paused on a hidden tab and says so.
`pnpm check:structure` fails a poll in a frontend package's React layer that
does not decide the flag beside its interval.
