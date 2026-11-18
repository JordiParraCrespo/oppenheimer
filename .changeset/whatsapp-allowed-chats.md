---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/shared": minor
---

A linked WhatsApp number keeps the chats its owner allows besides their own,
each with the bot that answers there. Stored and shown only: an allowed chat
wakes no bot yet.

- `@oppenheimer/api`: `GET`, `POST /v1/whatsapp/accounts/{id}/grants`,
  `PATCH` and `DELETE …/grants/{grantId}` (`WHATSAPP_015` to `WHATSAPP_018`).
  A bot's `allow_whatsapp_chat` and `revoke_whatsapp_chat`, offered only in
  the owner's console chat and their own WhatsApp chat, and
  `list_whatsapp_allowed_chats`. A bot that answers in an allowed chat is not
  deleted (`BOTS_043`). A tool can be kept to some turns (`onlyOn`).
- `@oppenheimer/api-client`: `findWhatsappChatGrants`, `allowWhatsappChat`,
  `updateWhatsappChatGrant` and `revokeWhatsappChat`.
- `@oppenheimer/web`: Settings → WhatsApp → Allowed chats, under a number
  whose owner is confirmed: each group or person, who allowed it, the bot
  that answers there, and Remove.
- `@oppenheimer/frontend-consumer`: `WhatsappChatGrantEntity`, and
  `WhatsappRepository.findGrants`, `answerChatAs` and `revokeGrant` with
  their hooks.
- `@oppenheimer/translations`: `settings.whatsapp.allowed.*` and
  `errors.byCode.WHATSAPP_015` to `WHATSAPP_018`, in English and Spanish.
- `@oppenheimer/shared`: `whatsappChatGrantSchema`,
  `allowWhatsappChatSchema`, `updateWhatsappChatGrantSchema`,
  `WHATSAPP_CHAT_KINDS` and `WHATSAPP_CHAT_GRANTS_MAX`.
