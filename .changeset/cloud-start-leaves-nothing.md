---
"@oppenheimer/runner": patch
---

A Claude Code cloud start leaves nothing on the host: the runner stops the CLI's whole process group, not only `claude` itself, forgets the scratch checkout in Claude Code's state (`~/.claude.json`, `projects/`), and deletes scratch checkouts a stopped runner left behind.
