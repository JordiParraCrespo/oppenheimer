---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
'@oppenheimer/runner': minor
---

Bots can read and write in the owner's WhatsApp, the way OpenClaw does it.
The runner pairs a spare number as a WhatsApp linked device (a QR code
scanned from the phone) and keeps its keys on the host; it is never shown
online, syncs no history, sends no read receipts and keeps a send budget of
its own. `RUNNER_WHATSAPP=off` turns it off. The link gains the `whatsapp`
capability and its `whatsapp.*` frames.

The new `whatsapp` module keeps each number (`whatsapp_account`, one per
host) and the messages it sees (`whatsapp_message`, 90 days), behind
`GET`/`POST /v1/whatsapp/accounts` and `DELETE /v1/whatsapp/accounts/:id`
with the `whatsapp:read`/`whatsapp:write` scopes. Bots get
`list_whatsapp_accounts`, `list_whatsapp_chats`, `read_whatsapp_chat`,
`search_whatsapp` and `send_whatsapp_message`, which asks unless the owner
allowed it for that chat. Settings → WhatsApp links, pairs and unlinks.
