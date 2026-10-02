---
"@oppenheimer/runner": minor
---

A session opens on its agent: `session.started` is reported when the agent is
sent into the pane rather than when the pane exists, so the console shows the
start's stepper while the repository arrives and then the agent. The line that
starts the agent clears the screen first.
