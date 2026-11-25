---
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/design-system-web": patch
"@oppenheimer/api": patch
---

fx, Vercel Labs' coding agent (`fx`), is an agent a session can run. It takes
a model as a Vercel AI Gateway id (`spacexai/grok-4.7` by default), an effort
with `--effort`, and the three permission levels as its own
`--permission-mode ask|auto|full-access`; a stopped session reopens its
conversation with `--continue`. The runner installs it from its GitHub
release, checked against the release's `.sha256`, into `~/.local/bin`, and
keeps it current with `fx upgrade`. Terminal only for now, with no chat view.
Settings → Agents lists it, off on a fresh device, as Pi and Oh My Pi are.
