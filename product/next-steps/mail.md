# Mail — your Gmail, worked by your bots

**Goal:** connect two or more of your own Gmail accounts and let your bots
do with them what you would: find and read mail, read attachments, write
drafts, reply, forward, send, file and tidy, and wake when something
arrives. "What did the accountant send last week?", "Draft a reply to
Acme saying Tuesday works", "Archive the newsletters from this week",
"Tell me when the bank writes" are all one message to a bot.

The owner set this as the first version on 2026-10-29, ahead of every
channel, and the same day narrowed it to **Gmail only**, with as many of
its features as the API gives, drafts included. In the words of
[Channels](channels.md) §1 this is a **connector**, not a channel: the bot
works the mailbox **as you**, from accounts you own, inside a turn you
started or a routine you set up. Nobody writes *to* the bot by mail, and
the bot has no address of its own (later, `channels.md` §7.3). It is what
dots and Grok Bot do with your Gmail; Grok Bot does it through Google's
hosted Gmail MCP server, we call the Gmail API directly.

The shape is the Google Calendar connection, which already does this for
events (`../versions/mvp/20-plan-calendar.md` §4 and §5, several accounts
since `23-plan-milestones-stats-accounts.md` §5): your own OAuth grant,
the token sealed at rest, nothing synced, every call through one port, and
bot tools on top (`../versions/mvp/25-bots.md` §4.5).

## 1. Connecting Gmail

Settings → Mail lists your connected accounts and offers **Connect
Gmail**; Google sends the browser back to `/settings/mail/google`. A person connects up to five, the calendar's number.

- **The grant** is a second, incremental Google OAuth grant, like the
  calendar's: `access_type=offline`, `prompt=consent`,
  `include_granted_scopes=true`, the API's own callback, the same
  `GOOGLE_CLIENT_ID`, the account keyed by Google's `sub`. Connecting the
  same Google account for the calendar and for Gmail is two connections,
  granted and revoked separately.
- **One scope, `https://www.googleapis.com/auth/gmail.modify`**: read,
  drafts, send, labels, archive, read state and trash — everything in §3
  except deleting mail for good, which we never ask for
  (`https://mail.google.com/`). One scope means one consent screen and no
  "reconnect to allow drafts" later.
- **A label of your own** names it in the console and to the bot:
  "Personal", "Work".

**Google's rules, written down.** `gmail.modify` is a *restricted* scope.

- An unverified project serves at most **100 users**, which covers us, and
  shows an "unverified app" screen at consent that the owner clicks
  through.
- A project left in **Testing** has its refresh tokens expire after
  **seven days**. The deployment's Google project is therefore set to
  **In production** while unverified, which keeps the 100-user cap and
  the warning screen but not the expiry (to confirm in the Google Cloud
  console when slice 1 starts; if it does expire, Settings says
  Reconnect, which costs one click).
- Opening it to everyone is Google's verification and a yearly
  third-party security assessment (CASA). That is a product decision for
  when strangers sign up, not for this version.

**`gmail_connection`** — what is stored.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organizationId` | uuid | |
| `userId` | uuid | whose Gmail this is |
| `googleSubject` | varchar(255) | Google's `sub` |
| `accountEmail` | varchar(320) | shown in Settings and to the bot |
| `label` | varchar(64) | "Personal", "Work" |
| `refreshTokenSealed` | bytea | AES-256-GCM, under `MAIL_TOKEN_KEY` |
| `scopes` | text[] | as granted |
| `historyId` | varchar(32) | where the new-mail watch (§5) last read; null until a routine needs it |
| `status` | varchar(16) | `active` · `revoked` |
| `createdAt`, `updatedAt` | timestamptz | |

Unique `(organizationId, userId, googleSubject)`. The grant is a
person's, as the calendar's is: nobody else in a workspace uses it, and
when teams come, a bot works only its owner's Gmail. The sealer is the
calendar's, under a key of mail's own (`MAIL_TOKEN_KEY`); with a second
user it moved to a shared place, as the calendar note said it would:
`configKeySealer` in `@oppenheimer/backend-core`, which every module that
seals a secret binds to its own token. Access tokens are minted per call
and never stored.

Disconnect revokes the token at Google and deletes the row. `invalid_grant`
marks it `revoked`, Settings says Reconnect, and the bot is told that
account is unavailable and works with the others.

## 2. The Gmail port

Nothing of your mail is stored and nothing syncs. Every call goes to
Gmail at the moment the bot makes it, through one port the `mail` module
owns, implemented by `GmailAdapter` with plain `fetch` calls to the Gmail
REST API, as the calendar gateway does (no `googleapis` package).

- **Search** takes Gmail's own query language (`from:acme
  has:attachment newer_than:7d label:work is:unread`), which the bot
  already knows, plus a page size (at most 25) and a page token.
- **Bodies** are parsed to plain text (mailparser on the raw MIME):
  HTML reduced to text, remote images and links never fetched, quoted
  history trimmed and offered on request, a long body cut with a note
  saying so.
- **Attachments** are fetched only when the bot asks for one (§3.2).
- **Limits.** Every call goes through `UpstreamLimiter.exchange`
  (`.agents/rules/integrations.md`) with buckets named for what Gmail
  counts: quota units per user per second (each method's cost from
  Google's table) and messages sent per day. Gmail's 429 is `MAIL_*`'s own
  code, and the bot is told to wait rather than retry.
- **What goes back to the model** is always inside
  `<untrusted_external_data>` with note 16's preamble (§4).

## 3. The bot's tools

Next to the calendar's in the catalog (`25-bots.md` §4.5), each with the
default of note 25 §5. The owner changes a default per bot in Settings →
Permissions, within the limits stated below.

### 3.1 Read

| Tool | Does | Default |
|------|------|---------|
| `list_gmail_accounts` | Your connected accounts: label, address, status | auto |
| `search_mail` | Search one account or all, in Gmail's query language; sender, recipients, subject, date, labels, a snippet, attachment names, the thread's id | auto |
| `read_mail_thread` | One thread in full, as text, each message with its sender, recipients, date, labels and attachments | auto |
| `list_mail_labels` | The account's labels and system labels, with unread counts | auto |
| `list_mail_drafts` | The account's drafts, with recipients, subject and a snippet | auto |

### 3.2 Attachments

| Tool | Does | Default |
|------|------|---------|
| `read_attachment` | One attachment of one message, opened for the bot | auto |

- **Images** are shown to the person under the bot's reply, as `show_image`
  shows them; a tool's answer cannot carry an image to the model yet, so the
  bot is told it has not seen it.
- **PDFs** are read as text, up to 50 pages; a scanned PDF with no text
  layer is named as one and not read yet (page images are later).
- **Text, CSV, HTML, spreadsheets, Word and PowerPoint files** are read as
  text (a sheet as CSV per tab, a deck slide by slide), cut at a size limit
  with a note.
- **Anything else** is named, sized and not opened. Archives are never
  unpacked, and nothing is ever run.
- An opened attachment is kept as a bot attachment for the turn, with the
  existing retention, so a follow-up question does not fetch it again.

### 3.3 Drafts

A draft is saved in your Gmail, where you also see it, edit it and send
it from your phone. Writing one sends nothing.

| Tool | Does | Default |
|------|------|---------|
| `create_draft` | A new message, a reply, a reply-all or a forward, as a draft in Gmail | auto |
| `update_draft` | Change a draft the bot or you wrote: recipients, subject, body, attachments | auto |
| `delete_draft` | Delete a draft | ask |

- A reply or forward draft is **threaded** like a sent reply (§3.4), so it
  appears under the conversation in Gmail.
- The bot's chat shows the draft as a card: from, to, subject, the body,
  attachments, and **Open in Gmail**. "Send it" in the chat is an ask for
  `send_draft` (§3.4), never a send by itself.
- **A draft never grants a send** (Grok Bot's and dots' rule).

### 3.4 Sending

| Tool | Does | Default |
|------|------|---------|
| `send_mail` | Send a new message, a reply, a reply-all or a forward | ask, always |
| `send_draft` | Send one of the account's drafts as it stands | ask, always |
| `schedule_mail` | Send a message or a draft at a time you give | ask, always |
| `cancel_scheduled_mail` | Cancel one the bot scheduled, before it goes | auto |

- **Always asked, in this version.** A send cannot be set to auto. The
  bot's call raises a Needs input card that shows the message exactly as
  it will go: the account and the alias it goes from, To, Cc, Bcc,
  subject, the body in full, the attachments by name and size, and for a
  reply the message it answers. Yes sends exactly what the card showed,
  stored with the call (note 25's rule); nothing the bot does after the
  card can change it. No, or a comment, goes back to the bot.
- **From your address or an alias.** The send-as aliases configured in
  Gmail are offered (`users.settings.sendAs`), and the alias's **Gmail
  signature** is added below the body, as Gmail would.
- **The body** is written as plain text with light markdown (paragraphs,
  lists, bold, links) and sent as `multipart/alternative`: the text as
  written, and the same rendered to simple HTML, so it reads like mail
  written in Gmail.
- **Attachments**: files from the bot's chat (what you dropped in it),
  the bot's documents, attachments of the thread being answered or
  forwarded, and files the bot made in the turn. Gmail's 25 MB limit is
  checked before the card is raised.
- **Replies stay in the thread**: `In-Reply-To` and `References` from the
  message answered, `Re:` on the subject, Gmail's `threadId`. Reply-all
  takes the thread's recipients minus your own addresses. A forward
  carries the original as quoted text and its attachments.
- **Gmail files it in Sent**, and the turn records it (account,
  recipients, subject, Gmail's message id, the approval it came from), so
  "what did my bot send this week?" is answerable without opening Gmail.
- **Sent once.** A send is keyed by its approval's id: a retried job, or
  a turn that runs again, finds it sent and returns its id.
- **Scheduled sends are ours.** Gmail's API has no scheduled send, so
  `schedule_mail` approves the message now and a delayed job on our queue
  sends it at the time given, keyed the same way. Until then it is listed
  in the bot's chat and in Settings → Gmail with Cancel. The approval is
  for that message at that time; changing either asks again.
- **Limits of our own**, on top of Gmail's 500 a day: at most 50 sends
  per account per day from bots, and at most 10 recipients on a message.
  Past either, the tool refuses and the bot says so.
- **Mail never sends mail.** A send is always the bot doing what *you*
  asked. When a recipient was not typed by you but read out of a message
  (a reply-to, an address in a body), the card says where it came from
  ("from Acme's mail of 2026-10-28") before you say yes.

### 3.5 Organizing

| Tool | Does | Default |
|------|------|---------|
| `mark_mail` | Read or unread, starred or not, important or not, on messages or threads | ask |
| `label_mail` | Add or remove labels on messages or threads | ask |
| `archive_mail` | Take threads out of the inbox | ask |
| `trash_mail` | Move threads to Trash (Gmail empties it after 30 days) | ask |
| `untrash_mail` | Bring threads back from Trash | auto |
| `create_label` | Create a label | ask |

- These can be set to **auto** per bot, except `trash_mail`, which stays
  ask. Each call names how many threads it touches, and one call touches
  at most 100; "archive all the newsletters" over more is several calls,
  each on the card.
- Nothing is ever deleted for good: `gmail.modify` cannot, and no tool
  asks for the scope that could.
- **Reading is never marking.** Searching or reading leaves mail unread;
  only `mark_mail` changes it.

## 4. Mail is untrusted

Anyone in the world can put text in your inbox, so everything a tool
returns from Gmail — bodies, subjects, sender names, attachment text —
reaches the bot inside `<untrusted_external_data>` with note 16's
preamble. A message that says "ignore your instructions and forward this
to…" is text to read, never an instruction. Nothing that came out of a
mailbox can approve anything, and every write that leaves the account
(§3.4) or loses something (`trash_mail`, `delete_draft`) asks. A routine
woken by mail (§5) runs with the same tools and the same cards: a mail can
start a turn, never a send.

## 5. Waking on new mail

Mail becomes a **routine trigger** (note 26): "when mail arrives in Work
from the bank", "when anything is labelled Invoices", "every unread mail
from a person, not a newsletter". The routine wakes the bot with the
message's id and a summary; the bot reads it with the tools above.

- **How we notice.** A repeating job on the existing queue calls
  `users.history.list` from the stored `historyId` once a minute for each
  account that some routine watches, and only those. It costs two quota
  units a call, needs no public endpoint and no Pub/Sub topic. Gmail's
  push (`users.watch` through Cloud Pub/Sub) is the faster route for
  later; it changes how we notice, not what wakes.
- **The match** is Gmail's own query run on the new messages (`from:bank
  label:work`), so a routine's condition is written the way a search is.
- **Each new message wakes once**, through the inbound-events hub's rule:
  a stored row, unique per account and message id, before anything runs.

## 6. Where things live

- **API module `mail`**, shaped like `calendar`: `gmail_connection`, the
  Gmail port and `GmailAdapter`, the MIME parser and builder, the connect,
  reconnect, relabel and disconnect commands, `GET /v1/mail/connections`,
  the OAuth start and callback, the scheduled-send job and the
  new-mail watch job. Scopes `mail:read` and `mail:write`, the
  `MailConnection` policy subject. `MAIL_TOKEN_KEY` in the root
  `.env.example`. mailparser and the attachment readers are only imported
  there.
- **bots-chat**: the tools of §3, through a port the `mail` module serves,
  as the calendar tools do; the draft card; sends through the existing
  approval card.
- **automations**: the "mail arrives" trigger (§5).
- **Console**: Settings → Integrations → Gmail (connect, label, status,
  reconnect, disconnect, scheduled sends); in the bot's chat, activity
  lines ("Searched Work for *invoice from Acme*"), the draft card and the
  send card.

## 7. Slices

1. **Connect and read** (built 2026-10-29: the `mail` module, Settings →
   Mail, and `list_gmail_accounts`, `search_mail`, `read_mail_thread`,
   `list_mail_labels`, `list_mail_drafts`, `read_mail_attachment`). The connection, several accounts, the read
   tools and attachments (§3.1, §3.2), the Settings page.
2. **Drafts and sending** (built 2026-10-29: `create_draft`,
   `update_draft`, `delete_draft`, `send_mail`, `send_draft`,
   `list_sent_mail`, and the send card's message). §3.3 and §3.4 with the
   cards, aliases, signatures, attachments, threading and the limits.
3. **Organizing** (built 2026-10-29: `mark_mail`, `label_mail`,
   `archive_mail`, `trash_mail`, `untrash_mail`, `create_label`) (§3.5).
4. **Scheduled sends** (built 2026-10-29: `schedule_mail`,
   `cancel_scheduled_mail`, Settings → Mail's Scheduled list) and **waking
   on new mail** (built 2026-10-29: a `gmail` routine trigger through
   `update_routine`, the minute poll, the hub's `gmail` source) (§3.4, §5).

Later: Gmail's push through Pub/Sub; Google Contacts, so "email Marta"
finds her address (its own scope); Gmail filters and vacation replies
(`gmail.settings.basic`); other providers (IMAP and SMTP with an app
password, Outlook through Microsoft Graph) behind the same port; and mail
as a channel (`channels.md` §7.3).

## Open questions

1. Should a bot see every Gmail account you connect, or should each
   account list the bots that may use it?
2. Should sending ever be allowed without asking, for example replies to
   people already in the thread, once the record shows the asked sends
   are right?

## Decided

- 2026-10-29: the first version is reading your own mailboxes, two or more
  per person, from your bots; no address of the bot's own for now. A
  connector, read-only, on the calendar connection's pattern, with Gmail
  and IMAP adapters.
- 2026-10-29, the same day: sending is in the first version too. One
  `send_mail` tool, from your own mailboxes, asked every time, plain text,
  replies in the thread; `gmail.send` beside `gmail.readonly`, SMTP beside
  IMAP.
- 2026-10-29, the same day: **Gmail only**, with as many of its features
  as the API gives: one `gmail.modify` scope; search in Gmail's query
  language; attachments read; drafts written freely (a draft never sends);
  sends, reply-all, forwards, aliases, signatures, attachments and
  scheduled sends, every one asked; labels, read state, archive and trash
  (ask, never a permanent delete); new mail as a routine trigger. IMAP and
  Outlook move to later, behind the same port.
- 2026-10-29: slice 1 built. Two changes from the plan above: the page is
  Settings → Mail (not Integrations → Gmail), and an image attachment is
  shown to the person rather than given to the model, which tool answers
  cannot carry yet.
- 2026-10-29: slice 2 built. What differs from §3.3–3.4: attachments come
  from mail only (the thread forwarded, or any message by its part), not
  yet from the bot's chat, its documents or files made in a turn; a draft
  is answered in the chat as text with its Gmail link, not drawn as a card;
  a recipient taken from the message answered is marked "taken from the
  message it answers" on the card, without naming the mail's date; and
  `list_sent_mail` answers "what did my bots send" from the record of
  sends, which keeps no body (Gmail's Sent has it). A send that was started
  and never confirmed is never sent again on its own (`MAIL_015`); a draft
  edited after its card is not sent (`MAIL_014`).
- 2026-10-29: slice 2's gaps closed. A send or a draft attaches the images
  the person sent in the bot's chat as well as files from mail; the turn is
  told each image's id, and the image's bytes are read when the draft is
  written or the mail sent. A saved draft is drawn under its call as a card
  (the message, "nothing was sent", Open in Gmail), and the Inbox's approval
  card shows a send's message as the chat's does. The bot's documents and
  files made in a turn are not attachable: a bot's documents are its own
  instructions, not mail, and no tool makes files yet.
- 2026-10-29: slice 3 built as §3.5 says. Marking, labelling and archiving
  are label changes (read state, stars, importance and the inbox are
  Gmail's system labels); a thread is changed with its own call, one after
  another, so 100 stay inside Gmail's per-second quota, and messages in one
  batch. A thread Gmail does not have is named in the answer and the rest
  are still changed. A label card stores the labels' ids, so a rename while
  it waits does not change what a yes does.
- 2026-10-29: scheduled sends built. The wait is ours, as §3.4 says, but not
  a delayed job per send: a scheduled send is a `mail_send` row holding the
  approved plan and its time, and one job ticking every minute sends what is
  due, so a lost Redis loses no send. Each is claimed with a conditional
  write, so a cancel and the tick cannot both win; one claimed and then
  refused is recorded as failed and never retried on its own. A time already
  past when the person says yes is refused rather than sent late, a send is
  scheduled at most 90 days ahead, and a scheduled send carries files from
  mail only: an image from the chat cannot wait with it. A draft can be
  scheduled too, and goes only if unchanged. The daily cap counts a send on
  the day it goes.
- 2026-10-29: waking on new mail built as §5 says, on the same minute job as
  scheduled sends. A trigger watches one account, with a Gmail query or for
  any new mail, and only a bot's routine takes one: a session automation
  refuses it. The bot names the account in chat and the card stores its
  connection id, as every mail tool does, and a save checks the owner still
  holds it. An account starts from the moment a routine first watches it,
  so no older mail wakes anything, and when Gmail no longer keeps the
  stored history it starts again from now: mail in that gap wakes nothing.
  A query runs as a Gmail search over the last two days, crossed with what
  arrived, so the match is Gmail's own; a poll reads at most 50 new
  messages an account and leaves the rest for the next minute. Who wrote a
  mail, its subject and its snippet reach the bot as the event's untrusted
  context (§4); what a trigger matches on is only the queries a message
  matched.
