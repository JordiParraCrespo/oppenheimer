---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/backend-agents": minor
"@oppenheimer/backend-storage": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Bots read images (`product/versions/mvp/25-bots.md` §3.1, issue #426).

- `@oppenheimer/shared`: `BOT_IMAGE_MIME_TYPES`, `BOT_IMAGE_MAX_BYTES`,
  `BOT_MESSAGE_IMAGES_MAX`, `BotAttachment`, `botTakesImages` and the
  provider catalog's `images`; `sendBotMessageSchema` takes `attachmentIds`
  and a message of images alone; the `bot-attachment-retention` queue.
- `@oppenheimer/api`: `POST /v1/bots/:id/attachments` (an image judged by its
  bytes) and `GET /v1/bots/:id/attachments/:attachmentId/content`; a message
  claims its images in the send's transaction and carries them in the chat;
  a turn sends its own message's images to the engine; the `bot_attachment`
  table and a daily sweep of images no message carries. Errors
  `BOTS_024`–`BOTS_028`.
- `@oppenheimer/backend-agents`: `BotTurnRequest.images`, sent as image
  blocks to the Claude engine and `input_image` parts to the OpenAI one.
- `@oppenheimer/backend-storage`: `StorageService.download`.
- `@oppenheimer/api-client`: the upload and read operations.
- `@oppenheimer/frontend-consumer`: `useUploadBotImage`, `useBotImage`, and
  a message's `attachments`.
- `@oppenheimer/design-system-web`: `ChatImage` and `ChatImageRemove`;
  `ChatComposer` takes `onAttach`, `attachments` and `allowEmpty`;
  `ChatUserMessage` with no words draws its attachments alone.
- `@oppenheimer/web`: the bot composer picks, pastes and takes dropped
  images, and the chat draws them above your message.
- `@oppenheimer/translations`: `bots.chat.images.*` and
  `errors.byCode.BOTS_024`–`BOTS_028`.
