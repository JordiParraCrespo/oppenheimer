---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/frontend-consumer': minor
---

A bot can manage projects from chat (issue #647). `create_project` and
`update_project` make a project or change its name, repositories and
default host and agent, refusing a name another project already has unless
the person asked for a second one; `archive_project` asks the person under
every preset, one call at a time, and names a project's open sessions
instead of raising a card it would refuse; `move_session` lists an existing
session under another project, or Unassigned, keeping its id, history,
state and worktree. Each goes through the projects' and sessions' own
commands and the request schemas the console validates with. `get_project`
now shows each repository's installation and repository ids.

Making, changing or archiving a project raises `project.changed` on the
workspace stream (`ProjectChangedDomainEvent`, staged on the outbox with the
write), and the console re-reads its projects on it, so the sidebar shows a
project a bot made without a reload.
