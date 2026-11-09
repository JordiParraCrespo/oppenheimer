---
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": minor
---

The bot composer recalls what you sent, as a shell does.

- `@oppenheimer/web`: Up with the caret at the start of the field writes your
  last message into it, Up again the one before; Down walks back and, past
  the newest, gives back the draft you had, even after you edited a recalled
  message (the arrows then move the caret through it, and step only from its
  very start or end, so a long line the field wraps keeps its arrows). A send starts the walk over. The open `/` menu keeps
  the arrows for its highlight. While a sent message is in the field, the box
  says which one over it ("History 1/2").
- `@oppenheimer/design-system-web`: `ChatComposer` takes `caption`, a quiet
  line inside the box over the field, announced as it changes.
- `@oppenheimer/translations`: `bots.chat.history`.
- `@oppenheimer/frontend-consumer`: `BotConversationEntity.sentTexts` (your
  messages with text, newest first, a repeat in a row once) and
  `useBotSentTexts`.
