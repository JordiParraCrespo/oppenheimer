---
'@oppenheimer/shared': minor
'@oppenheimer/runner': minor
'@oppenheimer/api': minor
'@oppenheimer/go-execx': minor
---

A bot can run one program on a paired host. `run_command` is a new tool
that asks first under Approve for me. It sends `host.exec` over the runner
link and reads back `host.exec.result`: the exit code, and stdout and
stderr kept to their last 32 KB each. The new `host.exec` capability gates
it. The program runs from argv with no shell, in the bot's own folder under
the host's workspaces (`bots/<bot id>`), for at most 120 s.

The host decides what may run. `runner exec mode off|allowlist|full` and
`runner exec allow|deny <program>` write `~/.oppenheimer/exec.json`. The
runner reads that file on every call, refuses it if another account can
write it, and starts with the mode off. A refused call is `command.failed`
with `EXEC_001` to `EXEC_005`.

`execx.Spec` gains `Output: Separate`, which keeps stdout and stderr apart,
and `Limit`, which keeps only the last bytes of each stream.
