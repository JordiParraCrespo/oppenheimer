---
'@oppenheimer/runner': minor
---

Codex sessions start in a trusted folder, as Claude Code's already do: before
a Codex launch the runner marks the session's folder, and the repository a
worktree belongs to, `trust_level = "trusted"` in Codex's `config.toml`, so
Codex no longer opens on "Trust this folder?". An answer already in the file
is kept, and the file is appended to, never rewritten.
