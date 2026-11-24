---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/backend-agents": minor
---

Bots' prompts are sorted by capability, and a capability's how-to that only
some turns need is a built-in skill in the Agent Skills format, read when the
work comes up: `watch-inbox`, `use-a-computer` and `use-a-browser`. Their
names are reserved.

A bot's tools may wait: the Claude engine defers a capability's tools behind
Claude Code's tool search on Anthropic's own API once their definitions pass
about 5,000 tokens together (`BotEngineTool.deferrable`,
`DEFER_TOOLS_ABOVE_CHARS`). A turn that cannot read skills gets the
capabilities' skills in its prompt in full.
