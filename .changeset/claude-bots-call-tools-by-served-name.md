---
"@oppenheimer/backend-agents": patch
---

Claude-engine bots no longer lose tool calls to "No such tool". Claude Code serves our tools as `mcp__oppenheimer__<name>`, but the prompt, descriptions and answers named them bare, so a model that called the name it read never ran the tool. The engine now names each tool the way Claude Code serves it wherever the model reads it, and strips the prefix again from tool output the chat shows.
