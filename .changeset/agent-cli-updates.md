---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
---

Each coding agent in the catalog names its CLI's own updater (`update`:
`claude update`, `codex update`, `opencode upgrade`, `grok update`), which the
runner now runs at boot and hourly so a host is never a release behind when a
new model needs the newer CLI. The Claude Code and OpenCode seeds move Sonnet 5
to Claude Sonnet 5.5 (`claude-sonnet-5-5`).
