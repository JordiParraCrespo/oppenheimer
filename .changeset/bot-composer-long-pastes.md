---
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/mcp': minor
---

Long pastes in a bot's chat, the way Claude Code and Codex hold them.

- `@oppenheimer/web`: the bot composer holds a paste over 1,000 characters or
  10 lines as one label, `[Pasted text #1 +1000 lines]`, and sends the pasted
  text in its place; Backspace or Delete takes a label out whole. A message
  longer than a bot takes keeps send off and says so. A long message you sent
  is folded in the chat to its first twelve lines, with Show all.
- `@oppenheimer/shared`: `BOT_MESSAGE_MAX` is 200,000 characters (was 16,000),
  room for a pasted log of a thousand lines or more.
- `@oppenheimer/api`: the JSON body limit is 1 MB (was Express's 100 KB), so a
  message at that length reaches the API.
- `@oppenheimer/mcp`: `ask_bot` takes the same longer message.
- `@oppenheimer/translations`: `bots.chat.pasted`, `bots.chat.fold`,
  `bots.chat.tooLong`.
