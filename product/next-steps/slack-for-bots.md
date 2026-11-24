# Slack for bots — ask a bot from Slack

**Goal:** you ask your bot from Slack, with `@Juno` in a channel or in a
direct message to it, and it answers in the thread you asked in, as it would
in the console.

Asked for on 2026-11-20 (JordiParraCrespo/oppenheimer#954). Asking from where
the work already is matters most for bots after GitHub
(`../research/orca-bots.md` §3, §4). This is [Channels](channels.md) §7.2's
Slack, changed in one way (§1), on the core
[Answering on Telegram and WhatsApp](answering-on-telegram-and-whatsapp.md)
built: the bot's conversations, the wake, the owner-only rule, the reply as
the turn's last step and the words sent as it goes.

## 1. One Slack app per bot

Each bot gets a Slack app of its own, so it has its own name and face in
Slack, and whoever writes to `@Juno` is talking to Juno. Nothing routes; the
binding is the answer, as a Telegram bot belongs to one Oppenheimer bot.

Channels §7.2 had one Oppenheimer app installed per workspace, speaking as
each bot with `chat:write.customize`. That routes by mention, but a mention
names the one app, so the bot asked would have to be read from the words, and
every bot would share one entry in Slack's member list and DMs. Orca makes one
app per bot too (`../research/orca-bots.md`).

- **Created from a manifest.** The bot's Slack settings answer its manifest
  (the bot's name and description, the scopes and events it needs, its events
  address) as Slack's "Create an app" link with the manifest filled in
  (`https://api.slack.com/apps?new_app=1&manifest_json=…`). The person picks
  their workspace, creates it, installs it, and pastes its **bot token** and
  **signing secret**. Orca creates the app itself from a one-time App
  Configuration Token; that token lasts twelve hours and is refreshed by a
  second one, and the app still has to be installed by hand, so pasting two
  values once is the smaller thing to keep. It can come later without
  changing anything else.
- **Scopes:** `app_mentions:read`, `chat:write`, `im:history`, `im:read`,
  `im:write`, and since 2026-11-24 `reactions:write`, `users:read` (§4) and
  `files:read` (§3). An app made before then keeps working without those
  three: no reaction, mentions read as ids, and images not seen (the bot is
  told so), until its scopes are updated and it is reinstalled.
  **Events:** `app_mention` and `message.im`. A thread in a
  channel is answered when the bot is mentioned in it; the bot does not read
  channels it is not asked in.
- **One app is one bot** (`UQ_slack_account_app`): the same app pasted for a
  second bot is refused (`SLACK_005`). Deleting a bot forgets its app.
- **Kept sealed.** The token and secret are sealed under `SLACK_TOKEN_KEY`
  (AES-256-GCM, the API's sealed-blob layout) and never answered. Without the
  key the server keeps no Slack app (`SLACK_003`).

## 2. How events arrive

- **Over HTTP, to the API:** `POST /v1/slack/events?bot=<id>`, as GitHub's
  webhooks do. The API holds no socket (Channels §2): Socket Mode would need a
  socket per app, kept somewhere.
- **Signed:** nothing is read before `X-Slack-Signature` is checked against the
  app's signing secret over the raw body, with the timestamp within five
  minutes (`SLACK_008` otherwise). The one exception is Slack's
  `url_verification`, which arrives when the app is created, before the person
  has a secret to paste; its answer only echoes the challenge.
- **Answered at once:** Slack wants an answer within three seconds. The event
  stages `SlackOwnerWroteDomainEvent` in the outbox and returns; the wake and
  the turn run after.
- **Once:** a retry, or a DM mention that arrives as both events, is one turn,
  keyed by the app, channel and message timestamp.

## 3. Who may ask

Workspaces are personal (`../versions/mvp/08-auth.md`), so Slack is the
owner's only.

- **The owner's Slack user** is recorded by a one-time code: the bot's Slack
  settings make one (ten minutes, stored hashed), and the owner sends
  `link <code>` to the app in its DM. A code in a channel records nothing.
  Another app (a new token for a different app or workspace) forgets the
  owner.
- **Anyone else is ignored**, in a channel or in the DM, with no reply. Nobody
  is held for Allow: there are no contacts on Slack yet.
- **The app's own messages, other bots', edits and joins** are ignored.
- **What the owner wrote** reaches the bot as their message, mentions and
  links made readable, as their Telegram message does. A person mentioned
  arrives by the name their workspace shows (`users.info`, at most ten a
  message, kept a day, 1.5 seconds for all of them), or by id when Slack will
  not say in time. Lookups and reactions count apart from the answer's posts,
  so they never spend its rate budget. Nothing else from the channel reaches
  it: the bot reads no thread history.
- **Images the owner shares** (since 2026-11-24) reach the bot as a console
  message's do. Up to four images a message (PNG, JPEG, GIF, WebP, 5 MB each)
  are fetched when the turn is queued, never while Slack waits for its
  answer. They are fetched with the app's token from `files.slack.com` only,
  following no redirect, judged by their bytes and kept as the owner's
  uploads. A file the bot cannot see (another type, too large, past four,
  refused by Slack, or a bot whose model reads no images) is named in the
  words the turn reads, so the bot does not answer as if nothing was
  shared. A message with images is a turn of its own: it is never folded
  into a running one.

## 4. Answers go in the thread

- **A thread is a conversation.** A mention or a DM at the top level starts a
  thread under it, and the answer goes there; a message in that thread
  continues the same conversation. A new question is a new top-level message,
  so there is no `/new`. `stop` in a thread asks its running turn to stop.
- **The answer** is the turn's last words in Slack's markdown (bold, links,
  code), in one message up to 39,000 characters (Slack folds a long one behind
  "Show more" and cuts at 40,000), so a long answer arrives whole; as on
  Telegram, what the bot writes before a tool call goes out as the call
  begins. Until 2026-11-24 answers were cut at 3,900 characters, Slack's
  advice, which split a long one into several.
- **Working.** The owner's message gets the app's 👀 reaction when its turn
  starts, before the turn goes on, and loses it when the turn ended, whether
  its answer went or not, so Slack shows the bot is on it. A message written into a thread while its turn runs is taken
  into that turn and gets none, nor does one that never became a turn.
- **The bot's own reactions** (2026-11-24, the owner: "better the agent
  decide"). The bot's `react` tool puts a reaction on the owner's message in
  the thread, as the app, one at a time, as it does in the console. Slack
  takes a reaction's name, not the character, so the bot reacts from a set of
  about a hundred common emoji the API names (`slack-reaction.policy.ts`), and
  is told to pick another outside it. 👀 stays the working sign's, which the
  turn's end takes off, so the bot is told to use another. It reacts to the
  message that opened a turn; one folded into a running turn has no key of
  its own, and the bot answers in words. The 👀 working sign is unchanged.
- **Secrets stay out of the thread.** Everything sent to Slack, as it goes
  and at the end, has secrets (tokens, keys, passwords, as the session
  transcript finds them) replaced with `[redacted]`; the console keeps the
  words as written.
- **In a channel everyone there reads the thread.** The bot is told so, and to
  keep private things (mail, memory, other people's details) out of it unless
  asked there. It is still the owner's turn with the bot's tools: the owner is
  the only one who can ask. Answering on Telegram and WhatsApp §3 narrows a
  group's turn; whether a Slack channel's should be narrowed too is open (§6).
- **Approvals stay in the console and the Inbox.** A turn that ends on a Needs
  input card adds "Waiting for your approval in Oppenheimer: <link to the
  bot>" to its answer. This is every channel's end, so Telegram and WhatsApp
  get the line too, as Answering on Telegram and WhatsApp §3 already said.
- **A token Slack refuses** (the app uninstalled, the token revoked) marks the
  app `revoked`, and its settings say so with New token.
- **Limits:** every call goes through `UpstreamLimiter`, bucketed per app and
  workspace, forty posts a minute (Slack allows about one a second per
  channel), `SLACK_007` on Slack's 429.

## 5. Where things live

- **API module `slack`:** `slack_account`, the events route and its raw-body
  parser, connect, owner link, disconnect, the reply (`ReplyOnSlack`). Scopes
  `slack:read` and `slack:write`, the `Slack` policy subject; the owner link is
  session-only, as Telegram's.
- **bots-chat:** the `slack` conversation kind and turn origin, the wake
  (`WakeOnSlack`), the reply through `BotChannelReplyResolver`, the turn
  context's line, the approval line at the end of every channel turn.
- **Console:** a **Slack** section on each bot's Gateways page: the three steps that
  create and connect its app, then the app, how it stands, the owner link,
  New token and Disconnect.

## 6. Open

1. A Slack channel's turn has the owner's tools (§4). Narrow it as a group's
   turn is narrowed on Telegram and WhatsApp, or keep it, since only the owner
   can ask?
2. Create the app from an App Configuration Token, as Orca does, instead of
   the manifest link and two pasted values?
3. Answering others in the workspace (contacts, as Telegram has them), and
   approval buttons in Slack.

## Decided

- 2026-11-20: one Slack app per bot, created from a manifest the console
  fills in, its bot token and signing secret pasted and sealed; events over
  HTTP to the API; the owner's Slack user only, recorded by a one-time code
  sent in the app's DM; answers in the thread asked in; approvals stay in the
  console with a link in the thread. Changes Channels §7.2's one app per
  workspace.
- 2026-11-24: from Orca's November releases' Slack fixes: mentions read by
  name, the 👀 reaction while working, a long answer in one message instead
  of cut at 3,900 characters, and secrets redacted in what goes to Slack.
  Two scopes added (`reactions:write`, `users:read`). Images on a Slack
  request were added the same day, with `files:read` (§3). Retrying a
  failed turn from its thread is not built yet.
- 2026-11-24: the bot reacts on Slack itself, with its `react` tool, beside
  the automatic 👀 (§4, "The bot's own reactions"); until then the tool
  worked in the console chat only.
