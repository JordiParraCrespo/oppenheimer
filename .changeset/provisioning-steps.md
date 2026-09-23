---
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/runner": minor
---

Starting a session shows the host's own steps — connect to the host, clone the repository, check out the branch, start the agent — as the design export draws them.

The runner logs each step as a `session.step` event as it starts and lands; the console reads them off the session's log (`useSessionEvents`, `deriveSessionStartSteps`) until the log says how the start ended. A finished step shows what the host reported (the time a clone took, the branch the worktree is on), and a failed one shows the host's own error.
