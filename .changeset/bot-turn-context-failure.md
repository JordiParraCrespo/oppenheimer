---
"@oppenheimer/api": patch
"@oppenheimer/backend-agents": minor
"@oppenheimer/shared": minor
"@oppenheimer/translations": patch
"@oppenheimer/api-client": patch
---

A bot turn that Claude Code ended because its context filled up (autocompact
thrashing, the window's hard limit, a prompt still too long after compacting)
no longer reads as "Anthropic refused this request … change the message or
the model". It fails as the new kind `context`, and the chat says the context
filled up, that the provider refused nothing, and to have the bot read less
at once or split the request.
