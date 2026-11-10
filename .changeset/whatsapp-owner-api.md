---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": patch
---

A linked WhatsApp number answers its owner
(`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 3).

- `@oppenheimer/api`: `PATCH /v1/whatsapp/accounts/{id}` chooses the
  number's default bot. `POST …/owner` names the owner's own number, which
  the linked number sends a six-digit code to, and `POST …/owner/confirm`
  enters it: only its hash is kept, it lasts ten minutes and five wrong
  codes lock it (`WHATSAPP_011` to `WHATSAPP_014`). The confirmed owner's
  messages in their own chat wake the chat's bot, and its answer comes back
  quoting their message; "Name: …" switches the chat to the one bot of
  theirs with that name, and `/new`, `/stop` and `/help` work as plain
  text. Strangers, groups, the number's own messages and its chat with
  itself are stored and answered by nothing. The bots' answers to the owner
  do not count toward their 100 sends a day.
- `@oppenheimer/api-client`: `updateWhatsappAccount`,
  `requestWhatsappOwner` and `confirmWhatsappOwner`; a WhatsApp account
  carries `answeringBotId`, `ownerNumber`, `ownerPendingNumber` and
  `ownerCodeExpiresAt`.
- `@oppenheimer/translations`: `errors.byCode.WHATSAPP_011` to `WHATSAPP_014`.
