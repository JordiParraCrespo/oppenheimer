---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
---

Who answers each WhatsApp chat, at the scale of dozens of groups and hundreds of people. Settings → WhatsApp → a number lists every chat it has seen in Groups and People tabs, with a search, a filter by who answers, a picker per chat (Not answered, the default bot, or a bot) and changes to many ticked chats at once; picking a bot allows the chat. A bot's settings gain Gateways: the WhatsApp chats it answers, Add chats and Remove, and the Telegram bots it answers on. New: `GET /v1/whatsapp/accounts/:id/chats` and `POST /v1/whatsapp/accounts/:id/routes` (session-only). A number allows up to 1,000 chats.
