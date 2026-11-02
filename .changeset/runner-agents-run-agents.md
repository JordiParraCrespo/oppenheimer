---
"@oppenheimer/runner": minor
"@oppenheimer/shared": minor
---

Agents run agents. From inside a session, `runner sessions run "task"`
starts a child session (in the parent's folder by default, or a worktree of
its own with `--repo`), `runner sessions send <id> "…"` types a message
into one, `runner sessions wait` waits until every child has finished a
turn, is blocked or ended, `runner sessions report "…"` sends the parent a
message, and `runner sessions children` lists them with what each says.
They go to the running daemon over its local socket.

A parent hears in its own input, as `<oppenheimer from="…" state="…">`,
when a child is blocked or through (`--quiet` turns that off); children end
with their parent unless `--outlive-parent`. A message waits for its agent
to be up (`SESS_012` after 30 s, which is usually a dialog for the person),
is pasted, and is submitted after the agent's paste gap, so an agent that
reads an Enter arriving with a paste as part of it still sends it.
`HOST_012` is a command that found no runner on the socket.

`runner --skill` prints the manual for an agent, every session's note
points its agent at it, and every session's PATH has `runner` on it.

- `@oppenheimer/shared`: the agent catalog's `input` (`submit`, `stop`,
  `pasteGapMs`), emitted into the runner's `launch_catalog.gen.go`.
