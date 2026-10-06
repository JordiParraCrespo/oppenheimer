---
"@oppenheimer/runner": patch
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": patch
---

A new session opens on its agent. The runner starts the agent in place of the
pane's shell (`tmux respawn-pane`) instead of typing the line that starts it,
and the console keeps the start's steps on screen until the agent step lands.
