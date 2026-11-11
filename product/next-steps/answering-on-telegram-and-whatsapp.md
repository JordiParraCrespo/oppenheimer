# Answering on Telegram and WhatsApp: who answers, who may talk

**Goal:** you write to your bot on Telegram or WhatsApp and it answers
there, as it would in the console. People you allow can write to it too,
and nothing a stranger or an allowed contact writes can reach your mail,
your sessions or your memory.

The owner asked for it on 2026-11-09. They sent `/start` to a Telegram bot
connected to Oppenheimer and nothing answered: [Telegram](telegram.md)
slice 1 keeps what the bot receives for your bots to read, and wakes no
one. Then: "We should have a default bot for this that can not be deleted
I guess no? I want to make safe how can talk to the bot as well no? We
need safety measures on this chats", "each bot might have different" and
"which bot gets the messages?". This note is the design for both: it is
[Telegram](telegram.md) slice 3 and [WhatsApp](whatsapp.md) slice 4, on
the core of [Channels](channels.md) and the routes of
[Customers and routes](customers-and-routes.md). It is built before either
note's routine trigger (slice 2 of each), which stays as it is. The
research is
[`../research/lessons-from-channel-gateways.md`](../research/lessons-from-channel-gateways.md)
§2 (OpenClaw) and §10 (Hermes Agent, read for this note).

## 1. Which bot answers

### Telegram: one Telegram bot per Oppenheimer bot

A bot made with @BotFather is an identity of its own, with its name,
photo and `@username`. So it belongs to one Oppenheimer bot: Juno gets
@JunoBot, Shop gets @ShopBot, and whoever writes to @JunoBot is talking to
Juno. Nothing routes; the binding is the answer.

- **Connected from the bot**, in a **Channels** section of the bot's page:
  paste the token, and that bot answers it. Settings → Telegram becomes the
  list of every connected Telegram bot and the Oppenheimer bot each
  belongs to.
- **Polled by the bot's home host** (`bot.homeHostId`). A bot without one
  is asked for one when its Telegram bot is connected. This replaces
  [Telegram](telegram.md) §2's one Telegram bot per host: a host polls one
  token per bot whose home it is, each with its own offset and outbox.
- **Changing the home host** asks for the token again: the token never
  rests on the control plane (telegram.md §2), so the new host cannot be
  handed it. The old host forgets it.
- **Telegram's own profile follows the bot's:** on connect and on a
  change, the runner calls `setMyName`, `setMyDescription`,
  `setMyCommands` and `setMyProfilePhoto` (the bot's avatar, drawn as an
  image).

### WhatsApp: one number, several bots behind it

A WhatsApp number is a spare one of yours (whatsapp.md §1): one identity,
so something has to choose.

- **A default bot per number**, chosen when the number starts answering.
  It is an account route (customers-and-routes.md §3, row 3), so a message
  always has a bot.
- **Routes pick another bot** for a person or a group, as
  customers-and-routes.md has them: a person or group is routed by being a
  customer's identity (its §2 and §3, rows 1 and 2), so "the family group
  → Juno" makes the family group a customer. A conversation keeps its bot
  once it opens. What a routed person's turn may do is §3's, the same as
  any contact's.
- **Your line is your personal number** writing to the spare one, as
  channels.md §5 has it. You name your personal number when the spare one
  starts answering, and the spare number sends it a six-digit code you
  enter in Settings → WhatsApp, so the number is yours and not a typo.
  (Until 2026-11-09 this said a code you send back from that number; with
  that, a stranger who owns a mistyped number would receive the code and
  could send it back as your line. Typed in the console, a stray code is
  useless to whoever got it.) A WhatsApp sender's number is
  WhatsApp's, not something a sender can set, so no one else can write as
  it. Your chat goes to the default bot, and a message starting with a
  bot's name and a colon ("Shop: what sold today?") moves that chat to
  that bot until you name another. Only your line switches by name; a
  contact gets the bot their route says. Hermes's dedicated-number mode is
  the same arrangement.

### A bound bot is not deleted

The answer to "a default bot that can not be deleted": any bot can be the
default, and while it is bound (a Telegram bot, a number's default, a
route's target) **deleting it is refused**, with an error naming what it
answers. Rebind it or disconnect first. No bot is special, and nothing is
ever left without one.

## 2. Who may talk

Who may write is a question about the account (the Telegram bot, the
number), never about the route: customers-and-routes.md §1 keeps the two
apart, as OpenClaw and Hermes do.

- **The owner on Telegram** is recorded when the bot is connected. The
  console shows a `t.me/<bot>?start=<code>` link (a one-time code, ten
  minutes); opening it sends `/start <code>`, and the sender's Telegram
  user id becomes the owner's for that bot. Hermes's **Create with QR**
  does the same. A plain `/start` from anyone is a stranger's.
- **The owner on WhatsApp** is their personal number, confirmed by a
  code (§1).
- **Allowed contacts** are a list per Telegram bot and per number, empty
  by default.
- **Anyone else is held.** Nothing reaches a bot; the console shows "@ana
  wants to talk to Juno" with **Allow** and **Ignore**. At most three
  wait per account, as Hermes keeps three pending codes; a fourth is
  dropped until one is answered.
  - On **Telegram** the stranger gets one fixed line, never written by a
    model ("This bot only talks to its owner."), at most once a day per
    sender, as Hermes's `decline`. Silence is a setting.
  - On **WhatsApp** the stranger gets nothing. It is your number, and a
    reply there is the riskiest thing a linked device does; Hermes
    recommends `ignore` for the same reason.
- **Approving is in the console only.** No code is typed back in a chat,
  so there is nothing to guess (Hermes locks out after five wrong codes;
  we have no codes to lock).
- **Groups are off.** A group is allowed by its id, and then the bot
  wakes only on a mention, a reply to it or a command; the lines in
  between are kept as context (channels.md §5). On Telegram, privacy mode
  already delivers only those; Settings says how to change it.
- **Other bots never wake ours** unless their account is allowed, and an
  exchange between bots stops after four of their messages since a
  person's last one (Hermes's `bot_loop_guard`).
- **Commands:** `/start` (the link), `/help`, `/new` (a fresh
  conversation) and, for the owner only, `/stop`, which pauses the bot in
  that chat.

## 3. What a contact's turn can do

- **The owner in their own direct chat with the bot is the owner**: the
  bot's tools, its permissions and its memory, as in the console. Only
  there.
- **A turn in a group is a contact's turn, whoever mentions the bot,** the
  owner included. Other people's lines are in its context and its reply is
  read by everyone in the group, so it gets the narrow tools and memory
  below. To have the bot act as you on something said in a group, ask it
  in your own chat.
- **A contact's turn has the customer turn's fixed tool set**
  (customers-and-routes.md §6): answer, read the bot's documents, remember
  for this conversation, `hand_off`. Mail, calendar, sessions, GitHub,
  other chats on Telegram or WhatsApp, and sending anywhere else are not
  there, whatever the bot's permissions say. A contact's message is a
  request, never an instruction to act as you. This changes channels.md
  §5, where a contact acted inside the owner's permissions.
- **A contact's turn reads no memory of yours**: not the general memory,
  and not the bot's own facts, which were learned from you. It reads its
  conversation's facts, or its customer's when the sender is one
  (customers-and-routes.md §5). This changes that note's §5, where a
  customer's turn also read the bot's own facts: a routed contact is a
  customer there, and the bot's own facts hold what you told it. What a
  bot should know for everyone it serves goes in its documents, which are
  shared because you wrote them.
- **What people wrote stays untrusted**, inside `<telegram>` or
  `<whatsapp>`, quotes and forwards included.
- **Approvals happen in the console, and only you answer them.** A
  contact's turn has nothing to approve. An owner's turn that needs a card
  sends a push and, on Telegram, one line to the owner's chat ("Waiting
  for your approval" and a link). A card unanswered in thirty minutes is
  denied, and the bot says so in the chat. Inline buttons in Telegram
  (OpenClaw's `execApprovals`) are not built: an approval is never answered
  from outside the console.

## 4. Running it

- **From message to turn** is channels.md §3: the message already kept in
  `telegram_message` or `whatsapp_message` is checked for access (§2),
  then opens or joins a conversation (channels.md §4), and queues the
  bot's turn with a short debounce. The reply is the turn's last step and
  needs no approval: it is the reply. Writing to any other chat is still
  `send_telegram_message` or `send_whatsapp_message`, which asks.
- **While it works:** Telegram's typing action, kept alive while the turn
  runs; after fifteen seconds, one line saying it is on it. WhatsApp shows
  nothing (whatsapp.md §2).
- **Replies** are split at Telegram's 4,096 characters and at our own
  8,000 on WhatsApp (whatsapp.md §4). On Telegram the bot's markdown is
  turned into Telegram's HTML by us, and everything else in it escaped, so
  only the formatting we produce is read as markup; this changes
  telegram.md §3, which sent plain text with no parse mode. WhatsApp gets
  its `*bold*` and `_italic_`. The pacing
  of telegram.md §3 and the send budget of whatsapp.md §2 still apply.
- **The host is offline:** the bot is silent, and its page and Settings
  say "Juno's host is offline". Telegram keeps a bot's updates for about a
  day, so a host back within it answers what came; the runner's ten-minute
  rule for a first poll (telegram.md §3) is unchanged.
- **Limits:**
  - **20 turns an hour per contact**; past it their messages are kept and
    wait, silently.
  - **A channel spend guard per bot**: a
    daily budget for turns started from Telegram and WhatsApp. Past it,
    contacts get nothing more that day, the owner is told once, and the
    owner's own turns still run.
- **You see everything:** every conversation shows under the bot's chat
  in the console (channels.md §4), held senders included. Each
  conversation has **Pause** and **Take over**: you answer from the
  console, through the same Telegram bot or number, while the bot stays
  quiet in that chat.
- **Data:** kept as telegram.md §4 and whatsapp.md §3 keep it (90 days),
  deleted with the binding, and one contact's history can be deleted on
  its own.

## 5. Settings

| Where | What |
|---|---|
| **Bot → Channels** | Its Telegram bot (connect, owner link, state), that bot's allowed contacts and held senders, its groups, what strangers get; the WhatsApp contacts and groups routed to it; the channel spend guard |
| **Settings → WhatsApp** | The number, its default bot, its allowed contacts and held senders, its groups |
| **Settings → Telegram** | Every connected Telegram bot and the bot it belongs to |

The bot's permissions, the Telegram and WhatsApp permission groups and the
per-chat "Always allow" for sends are unchanged.

## 6. Slices

1. **The owner on Telegram.** The binding per bot on its home host, the
   owner link, the owner's turns and replies, the commands, the profile
   sync, strangers held with the fixed line, deleting a bound bot refused.
   Your `/start` is answered.
   *Built 2026-11-09 on today's runner (one Telegram bot per host), the bot
   chosen in Settings → Telegram; the owner's chat is a conversation of its
   own (`bot_conversation`). Left for the runner's pull request: a host
   polling one token per bot, the bot's profile kept in step, Telegram's
   formatting and the typing action. Left for the Channels pull request:
   the bot's own Channels section. The turn runs in UTC until the owner's
   zone is known on Telegram.*
2. **Contacts on Telegram.** Allowed contacts, Allow and Ignore, the
   contact's turn (§3), groups, the limits and the spend guard, Pause and
   Take over.
3. **WhatsApp.** The owner's personal number confirmed, the default bot and switching
   by name, contacts and groups through routes.
   *Being built 2026-11-09 for the owner only: the default bot on the
   number (`whatsapp_account."answeringBotId"`, chosen in Settings →
   WhatsApp, deleting it refused with `BOTS_043`); your number confirmed by
   a code entered in the console; your messages as turns in a WhatsApp
   conversation of their own, answered as a quoted reply; "Name: …" moving
   the chat to the one bot of yours with that name, and `/new`, `/stop`,
   `/help` as plain text. The chat's order is the order the control plane
   stored the messages in (`whatsapp_message.seq`). Strangers, groups, the
   number's own messages and its self-chat are stored and do nothing else.
   Left for later: contacts and groups through routes.*
4. **Voice notes**, transcribed through voice's providers, on both.

## Open questions

1. Should the token rest on the control plane, encrypted, so a bot can
   change its home host without asking for it again (telegram.md's open
   question 1)? This note keeps it on the host.
2. Is three Telegram bots per person still the cap, now that each
   belongs to a bot?
3. Telegram strangers: one fixed line (the default here) or silence?
4. A bot made only for contacts (a shop's front desk) may want its own
   facts in a contact's turn. This note says its documents suffice; should
   a bot be markable as contact-facing instead?

## Decided

- 2026-11-09: a Telegram bot belongs to one Oppenheimer bot, polled by
  that bot's home host; a WhatsApp number has a default bot and routes,
  and your personal number, confirmed by a code, is your line there. A
  bound bot cannot be deleted. Strangers are held: one fixed line on Telegram,
  nothing on WhatsApp; Allow and Ignore in the console, no codes in chat.
  A contact's turn, and any turn in a group, gets the customer turn's
  tools and none of your memory; a customer's turn no longer reads the
  bot's own facts.
  Approvals are answered in the console only. From OpenClaw and Hermes
  Agent.
