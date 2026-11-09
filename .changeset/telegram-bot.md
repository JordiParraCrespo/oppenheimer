---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
'@oppenheimer/runner': minor
---

Bots can read and answer the chats of a Telegram bot the owner made with
@BotFather, the way OpenClaw does it. The runner holds the bot's token on
the host and long-polls the Bot API (no webhook, no public URL), pacing its
sends to Telegram's limits and pausing on a `429`. `RUNNER_TELEGRAM=off`
turns it off. The link gains the `telegram` capability and its `telegram.*`
frames.

The new `telegram` module keeps each bot (`telegram_account`, one per host)
and the messages it receives (`telegram_message`, 90 days), behind
`GET`/`POST /v1/telegram/accounts` and `DELETE /v1/telegram/accounts/:id`
with the `telegram:read`/`telegram:write` scopes; the token crosses the
control plane once and is never stored there. Bots get
`list_telegram_accounts`, `list_telegram_chats`, `read_telegram_chat`,
`search_telegram` and `send_telegram_message`, which asks unless the owner
allowed it for that chat. Settings → Telegram connects and disconnects.
