---
"@oppenheimer/backend-agents": patch
"@oppenheimer/api": patch
---

A bot's tool answer cut through an emoji no longer fails the turn on Grok. Cutting by length could leave half of an emoji (a lone surrogate). The SDK sent that half as a `\uD83D` escape, and xAI's API rejected the whole request with a 400 ("unexpected end of hex escape"). Tool cuts (`cut`, the web page and transcript limits) now keep whole characters, and `runTool` replaces any lone half with U+FFFD before the model reads it. A 400 that says the provider could not parse the request is now an `other` failure, not `refused`, so the chat no longer tells the person to change their message or model.
