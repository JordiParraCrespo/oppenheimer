---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/web": patch
"@oppenheimer/design-system-web": patch
---

ZCode (`zcode`, Z.ai's coding agent) is an agent a session can run, as a
proof of concept read off ZCode 4.0.0's source and not yet watched live. The
runner probes `zcode` on PATH and starts its TUI with `--mode build|edit|yolo`
for Ask, Auto and Full access, and reopens the worktree's conversation with
`--continue`. ZCode has no `--model` and takes no first task on its command
line, so its sessions offer no model, the task is optional as a blank
terminal's is, and the person types the first one in the terminal. The runner
does not install it: Z.ai publishes desktop installers and no terminal
release. Its screen manifest reads `esc to interrupt` as working and the
approval dialog as waiting on the person. Off in New session's picker until
switched on in Settings → Agents; terminal only, no chat view.
