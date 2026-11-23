---
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/design-system-web": patch
---

Hermes (`hermes`, Nous Research's agent) is an agent a session can run. It
starts as `hermes chat` with the first task as `--query`, which on a terminal
seeds an interactive session, and reopens its conversation with `--continue`.
It runs the model and approvals its own configuration names (`hermes model`,
`approvals.mode`), so the picker offers no model, effort or permission chip
for it, and the runner keeps it current with `hermes update --yes` but does
not install it: Nous's only installer is a piped script nothing checks.
Settings → Agents lists it, off on a fresh device, with its mark.

A Hermes session has a Chat view. Hermes keeps its conversations in SQLite
(`$HERMES_HOME/state.db`) rather than a transcript file, so the runner reads
the newest CLI conversation Hermes started in the session's directory since
the session was created, read only: its prompt, thoughts, tool calls (its
`terminal`, file and patch tools as Bash, Read, Write and Edit) and replies,
live, back across a compaction, and starting over on an undo. Bots and `opp`
read it a page at a time.
