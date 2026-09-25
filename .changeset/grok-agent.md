---
"@oppenheimer/shared": minor
---

Add Grok (xAI's Grok Build CLI, `grok`) to the coding-agent catalog, with Grok 4.7
and Grok 4.6 (the default) as its models. Permission levels map to
`--permission-mode default | acceptEdits | bypassPermissions`, the effort slider to
`--reasoning-effort`, the first task is the trailing positional, `GROK_HOME` scopes
the login, and `accounts.x.ai` / `auth.x.ai` are its login hosts. The runner launches
it and probes for `grok` on every host.
