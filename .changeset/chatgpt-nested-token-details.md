---
"@oppenheimer/backend-agents": patch
---

A ChatGPT subscription turn no longer fails when the Codex backend nests an
object in its usage's input token details (`cache_write_tokens_details`).
The OpenAI Agents SDK moves to 0.21, whose usage schema accepts it; the
turn still counts the cached tokens from `cached_tokens`.
