---
"@oppenheimer/runner": patch
---

A closed session's agent no longer keeps running. On one host ~110 agents of
closed sessions (~8–10 GB) had idled for ten days, because Claude Code ignored
the hangup `tmux kill-session` sends and nothing came after it.

- `runner pty` hangs its program's process group up when it is told to end
  (SIGHUP, SIGTERM, SIGINT, SIGQUIT, its context) or its pane stops taking
  output, gives it 10 s to save its conversation and exit, then kills the
  group and returns. A second SIGTERM, SIGINT or SIGQUIT kills at once. While
  the pane is gone it keeps reading the program's output, so a program
  writing to a full terminal can still exit.
- Stop, close and `uninstall --force` find the session's wrapper in the
  process table after `kill-session` and end it the same way, so `closed`
  means nothing of the session runs.
- The daemon looks at boot and every 5 minutes for a wrapper whose session
  has no tmux session (closing and stopping kill it), ends it, and logs the
  session and pid. Only processes of this account whose command line is
  `pty --report <file> --`, with the file in this runner's
  `state/program-status/`, are ever looked at.
