---
"@oppenheimer/api": patch
"@oppenheimer/runner": patch
"@oppenheimer/shared": patch
---

A session names the agent's own conversation, so a stopped session can be
reopened instead of read back.

These CLIs already keep the transcript — the catalog's `transcriptLocation` is
where — so nothing said in a session was ever lost. What was missing was a name
both sides agree on: the CLI picked its own id and told nobody, so the only way
back to a conversation was the tmux pane, which dies with the session. A run
stopped by the hour limit left a console screen saying "This session has
stopped" and nothing else, which for an automation run is the whole result.

The launch now carries `conversation`, the session's own id, and the catalog
says per agent how to pin it and how to reopen it — `--session-id` and
`--resume` for Claude Code. An agent whose CLI cannot be told an id, or that
keeps no transcript at all (the blank terminal), is sent nothing.

Verified end to end: a session created, answered, its tmux session destroyed,
and `--resume` in the same worktree brought back the whole conversation, live
and ready for a follow-up.
