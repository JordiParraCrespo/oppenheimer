---
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
---

The bot composer recalls what you sent, as a shell does.

- `@oppenheimer/web`: Up with the caret on the field's first line writes your
  last message into it, Up again the one before; Down walks back and, past
  the newest, gives back the draft you had. Editing a recalled message makes
  it an ordinary draft, so the arrows move the caret again. The open `/` menu
  keeps the arrows for its highlight.
- `@oppenheimer/frontend-consumer`: `BotConversationEntity.sentTexts` (your
  messages with text, newest first, a repeat in a row once) and
  `useBotSentTexts`.
