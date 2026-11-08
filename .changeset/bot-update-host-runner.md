---
'@oppenheimer/api': minor
'@oppenheimer/docs': patch
---

A bot can update a host's runner. The new `update_host_runner` tool sends
the console's Update runner (`hosts:write`, asks first under Approve for
me), `list_hosts` shows each host's runner version, and the answers that
meet a runner too old (a session's transcript, a shared file's preview, a
terminal watch) point the bot at the tool instead of telling it to ask the
person.
