---
title: Asking a bot from Slack
description: A bot's own Slack app (Gateways → Slack), linking your Slack user, asking with a mention or a DM, answers in the thread.
sidebar_position: 5.7
---

# Asking a bot from Slack

Each bot can have a Slack app of its own, with its name and face. In the bot's settings, **Gateways**, under **Slack**: **Create in Slack** opens Slack's "Create an app" with the bot's name, the permissions it needs and where its events go already filled in; pick your workspace and create it, then **Install to Workspace** in the app's settings, and paste its **Bot User OAuth Token** (`xoxb-…`, under OAuth & Permissions) and **Signing secret** (under Basic Information). Both are kept encrypted and never shown again. Then **Link my Slack user**: send the app the `link …` message it shows, in the app's direct messages, within ten minutes, and **Check**.

Mention the bot in a channel it is in (`@Juno what failed last night?`), or write to it in its direct messages. It answers in the thread under your message, and a reply in that thread continues the same conversation; a new message starts a new one. Write `stop` in a thread to stop what it is doing there. It answers only you: anyone else who mentions it is ignored. In a channel everyone there reads the thread, so it keeps private things (mail, memory, other people's details) out unless you ask there. A card that needs your approval stays in Oppenheimer and the Inbox, and the thread gets a link to it. One Slack app is one bot; **Disconnect** forgets the app's token, and the app stays in Slack until you delete it there. The server needs `SLACK_TOKEN_KEY` set to keep Slack apps.
