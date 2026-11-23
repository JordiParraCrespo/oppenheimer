---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/api-client": minor
"@oppenheimer/shared": minor
"@oppenheimer/translations": minor
---

Ask a bot from Slack: each bot can have a Slack app of its own (bot settings → Slack), created from a manifest the console fills in, its bot token and signing secret sealed under `SLACK_TOKEN_KEY`. The owner links their Slack user with a one-time code sent in the app's DM; then a mention in a channel or a DM wakes the bot, which answers in the thread (`POST /v1/slack/events`, signed). Anyone else is ignored. A channel turn that ends on an approval card links to it, on Telegram and WhatsApp too.
