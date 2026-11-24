---
"@oppenheimer/shared": minor
"@oppenheimer/api": patch
"@oppenheimer/runner": minor
"@oppenheimer/web": patch
"@oppenheimer/design-system-web": patch
---

ZCode (`zcode`, Z.ai's coding agent) is an agent a session can run, as a
proof of concept read off ZCode 4.0.0's source and not yet watched live. The
runner probes `zcode` on PATH and starts its TUI with `--mode build|edit|yolo`
for Ask, Auto and Full access. A restart opens a fresh ZCode: its
`--continue` exits when nothing was saved yet. ZCode has no `--model` and takes
no first task on its command line, so its sessions offer no model, the task is
optional as a blank terminal's is, and the person types the first one in the
terminal; a bot's `start_session` and `runner sessions run`, whose task is
required, refuse it. The runner
does not install it: Z.ai publishes desktop installers and no terminal
release. Its screen manifest reads `esc to interrupt` as working and the
approval dialog as waiting on the person. Off in New session's picker until
switched on in Settings → Agents.

ZCode has a chat view. ZCode keeps its conversations in one SQLite database
(`~/.zcode/cli/db/db.sqlite`) in OpenCode's shapes, so the runner reads it
read-only with OpenCode's chat follower, over a store that stands in for
OpenCode's API, and leaves out the messages ZCode writes for the model alone.
ZCode calls those tables an implementation detail: a release that moves them
breaks the chat view until the reader follows.
