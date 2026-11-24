---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
---

A bot turns a host's switches on when the person asks, instead of telling
them to run `runner browser on` on the host.

- `@oppenheimer/shared`: the link gains `host.settings.set` and
  `host.settings`, gated on the `host.settings` capability, with
  `HOST_EXEC_MODES`, `HOST_SWITCH_STATES` and `HOST_EXEC_ALLOW_MAX`.
- `@oppenheimer/runner`: answers `host.settings.set` by writing the files
  `runner browser`, `runner computer` and `runner exec` write; a bad
  allowlist entry changes nothing (`EXEC_008`).
- `@oppenheimer/api`: bots get `set_host_settings`, offered only on the
  owner's own turns and one card per call under Approve for me; the
  browser, computer, exec and terminal refusals point the bot at it.
