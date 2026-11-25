---
"@oppenheimer/backend-agents": patch
---

Claude-engine bots no longer lose tool calls to "No such tool". Claude Code serves a bot's tools as `mcp__oppenheimer__<name>`, but everything the model reads names them bare, so a call by the name it read ran nothing. The engine now ends the system prompt with a fixed note on how to call tools there. The texts themselves (the person's words, mail, web pages, transcripts) are left as they are.
