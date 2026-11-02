---
'@oppenheimer/shared': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': patch
---

One chat item model for the bots chat and the session chat:
`@oppenheimer/shared/schemas/chat-item` (a turn with its status, and items
typed by what they are, each in progress, completed or failed), and pure
adapters in the product package that read a bot's conversation and a Claude
Code transcript into it. Both chats now read tool calls through one
`classifyTool` (kind, item type, glyph name, name in words, target) in the
product package instead of a table each. Nothing on screen changes.
