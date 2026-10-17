---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": patch
"@oppenheimer/backend-core": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
---

Bot settings polish (`product/versions/mvp/25-bots.md`, 2026-10-16).

- `@oppenheimer/api`: `GET /bots/:id/conversation/export` streams the whole
  chat as NDJSON, one message per line, a page at a time; `DELETE /bots/:id/conversation` clears it (turns,
  messages, cards, summary, sidebar line) in one transaction, refused with
  `BOTS_022` while a turn is queued or running; the conversation read
  carries `messageCount`.
- `@oppenheimer/api-client`: `exportBotConversation`, `clearBotConversation`,
  `messageCount`.
- `@oppenheimer/frontend-consumer`: `useSuspenseBotHistory`,
  `useExportBotConversation` (reads the NDJSON stream a line at a time),
  `useClearBotConversation`.
- `@oppenheimer/backend-core`: `ndjsonLines` and `NDJSON_CONTENT_TYPE`.
- `@oppenheimer/frontend-web`: `SettingsFormSaveRow`, the dirty / pending /
  saved foot of a settings form.
- `@oppenheimer/design-system-web`: `SettingsListRow`'s `kind` tag never wraps;
  the meta beside it does.
- `@oppenheimer/translations`: Home host, chat history, `BOTS_022`, and the
  shorter ChatGPT sign-in chip.
