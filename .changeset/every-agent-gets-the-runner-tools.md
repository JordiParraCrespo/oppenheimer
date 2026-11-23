---
"@oppenheimer/runner": minor
---

Every agent a session starts knows Oppenheimer. `runner mcp` serves the session commands (start and message other agents, notify, send a file, wake on a pull request or later) as MCP tools, and the runner hands it to Claude Code, Codex and OpenCode at launch, beside the person's own servers. Codex is told where the session note is and OpenCode reads it, which neither did before: both stop looking at the checkout, below the session's folder.
