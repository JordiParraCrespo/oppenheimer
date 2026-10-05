---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
---

A host gets the repository ready while New session is still being written:
picking a host and a repository sends `repository.prepare`
(`POST /v1/sessions/prepare`), and the host clones or fetches it and builds a
spare worktree, so the create that follows starts in about a second. A first
clone is shallow and deepened in the background, checkouts write from one
worker per core, and session branches are cut `--no-track`.
