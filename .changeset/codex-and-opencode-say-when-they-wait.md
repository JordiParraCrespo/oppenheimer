---
"@oppenheimer/runner": minor
---

Codex and OpenCode sessions now say when they wait on you. Their detection rules were rewritten from the real CLIs' screens (Codex 0.171, OpenCode 1.19.6): Codex's approval and Plan-mode question, and every OpenCode permission, read as blocked instead of working or unknown. A block is confirmed 3 s after the runner sees it, not 15 s.
