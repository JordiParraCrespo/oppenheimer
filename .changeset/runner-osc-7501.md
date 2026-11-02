---
"@oppenheimer/runner": minor
---

A session's agent now runs under `runner pty`, which speaks OSC 7501, the
Program Status Protocol. Claude Code (2.1.295 and later) reports what it is
doing only to a terminal that answers its `OSC 7501 ; ?` probe, and tmux
answers none, so the wrapper sits between the agent and its pane: it
answers the probe, keeps every report in a file under the runner's state
directory, and passes every other byte through in both directions.

The poll loop takes the agent's own word over the screen classifier while
it holds one (`idle`, `working`, `done`, `blocked` with its kind, `error`
read as `done`); the screen stays the fallback for agents that say nothing
and the only source of a vendor login. `agent.observed` carries the report
as an optional `program` object (`state`, `kind`, `progress`, `message`,
`title`), and a new message on a session that stays blocked is published
without restarting its blocked clock. Progress alone publishes nothing.
