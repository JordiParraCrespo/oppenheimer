---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": patch
"@oppenheimer/translations": patch
"@oppenheimer/runner": patch
---

Lay the ground for a bot answering its owner on WhatsApp
(`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 3),
with Telegram answering exactly as before.

- `@oppenheimer/api`: the `AnswerOnWhatsapp` migration gives a linked
  number its default bot (`answeringBotId`) and its owner's number and
  pending code, gives each stored WhatsApp message the order it was stored
  in (`seq`), the bot a "Name: …" switched to and whether it was the bot's
  reply, and lets a bot conversation and a turn be WhatsApp's. The pieces of
  bots-chat that were Telegram's now work for any channel: a channel's chat
  (`findChannelChat`), the conversation a message starts, Clear history,
  whether a turn can still answer, the turn-context line, an ask's answer,
  and one `deliver-channel-reply` job, which the worker also takes under the
  old `deliver-telegram-reply` name for one release. Deleting a bot that is
  a WhatsApp number's default answers `BOTS_043`.
- `@oppenheimer/shared`: `whatsapp` is a turn origin (`BOT_CHANNEL_ORIGINS`,
  `isChannelOrigin`); the WhatsApp account carries `answeringBotId`,
  `ownerNumber`, `ownerPendingNumber` and `ownerCodeExpiresAt`, with the
  update, owner and confirm schemas; `whatsapp.send` takes an optional
  `replyTo` to quote, which an older runner ignores; `splitReplyText` cuts a
  reply for any channel.
- `@oppenheimer/api-client`: `deleteBot` documents `BOTS_043`.
- `@oppenheimer/translations`: `errors.byCode.BOTS_043`.
- `@oppenheimer/runner`: the generated link vocabulary carries
  `whatsapp.send`'s `replyTo`, which the runner quotes from.
