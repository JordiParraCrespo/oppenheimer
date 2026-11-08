---
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
---

The bot composer recalls what you sent, as a shell does.

- `@oppenheimer/web`: Up with the caret on the field's first line writes your
  last message into it, Up again the one before; Down walks back and, past
  the newest, gives back the draft you had, even after you edited a recalled
  message (the arrows then move the caret through it, and step only from its
  first or last line). A send starts the walk over. The open `/` menu keeps
  the arrows for its highlight.
- `@oppenheimer/frontend-consumer`: `BotConversationEntity.sentTexts` (your
  messages with text, newest first, a repeat in a row once) and
  `useBotSentTexts`.
