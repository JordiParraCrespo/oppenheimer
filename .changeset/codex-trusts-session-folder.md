---
'@oppenheimer/runner': minor
---

Codex sessions start in a trusted folder, as Claude Code's already do: before
a Codex launch the runner marks the session's folder, and the repository a
worktree belongs to, `trust_level = "trusted"` in Codex's `config.toml`, so
Codex no longer opens on "Trust this folder?". An answer already in the file
is kept, the file's own text is kept with the new tables added at its end,
and a symlinked config stays a symlink.
