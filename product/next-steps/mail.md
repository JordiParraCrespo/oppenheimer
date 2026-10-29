# Mail — your mailboxes, read and sent from by your bots

**Goal:** connect two or more of your own mail accounts and let your bots
read them and send from them. "What did the accountant send last week?",
"Summarise what came in on the support inbox today", "Is there a reply
from Acme?" are answered from your real mail, in the bot's chat; "Reply to
Acme that Tuesday works" sends that reply from your own address, once you
approve it.

The owner set this as the first version on 2026-10-29, ahead of every
channel: no address of the bot's own for now, and nobody writes *to* the
bot by mail yet. In the words of [Channels](channels.md) §1 this is a
**connector**, not a channel: the bot reads and sends mail **as you**, from accounts
you own, inside a turn you started. It is what dots and Grok Bot do with
your Gmail (Grok Bot through Google's hosted Gmail MCP server).

The shape is the Google Calendar connection, which already does the same
thing for events (`../versions/mvp/20-plan-calendar.md` §4 and §5): your
own OAuth grant, several accounts per person, the token sealed at rest,
nothing stored and nothing synced, a read through one port, and bot tools
on top (`../versions/mvp/25-bots.md` §4.5).

## 1. Connecting an account

Settings → Integrations → Mail lists your connected mailboxes and offers
**Connect Gmail** and **Connect another mailbox**. A person connects up to
five, the calendar's number.

- **Gmail (and Google Workspace):** a second, incremental Google OAuth
  grant, like the calendar's: `access_type=offline`, `prompt=consent`,
  scopes `https://www.googleapis.com/auth/gmail.readonly` and
  `https://www.googleapis.com/auth/gmail.send`, the API's own
  callback, the same `GOOGLE_CLIENT_ID`. The account is keyed by Google's
  `sub`. Connecting the same Google account for the calendar and for mail
  is two connections, granted and revoked separately.
- **Any other mailbox (IMAP and SMTP):** the IMAP and SMTP servers, user
  and an **app password** (Gmail with 2-Step, iCloud, Fastmail, Yahoo, most
  hosts; the servers filled in for the known ones), tested by logging in to
  both on save. The password is sealed like a refresh token. A plain
  account password is refused where the provider has app passwords.
- **Outlook / Microsoft 365** needs Microsoft's OAuth (Microsoft Graph,
  `Mail.Read` and `Mail.Send`), since Microsoft no longer accepts passwords for IMAP on Outlook.com and Microsoft 365. It is
  the third adapter, after the first two.

**Google's rule for Gmail, written down.** `gmail.readonly` is a
*restricted* scope. While the Google project is in Testing it serves up to
100 test users, which covers us, but Google expires a Testing project's
refresh tokens after seven days, so a Gmail connection would ask to
reconnect weekly. Publishing it means Google's verification plus a yearly
third-party security assessment. Until that is worth doing, **IMAP with an
app password is the dependable route for Gmail too**, and the Gmail OAuth
button is there for whoever accepts the weekly reconnect. Which one the
owner's two accounts use decides what is built first (open question 1).

**`mail_connection`** — the only thing stored.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organizationId` | uuid | |
| `userId` | uuid | whose mailbox this is |
| `provider` | varchar(16) | `gmail` · `imap` (· `outlook` later) |
| `accountEmail` | varchar(320) | shown in Settings and to the bot |
| `label` | varchar(64) | your name for it: "Personal", "Support" |
| `config` | jsonb | IMAP and SMTP host, port, TLS, user; empty for Gmail |
| `secretSealed` | bytea | the refresh token or the app password, AES-256-GCM |
| `status` | varchar(16) | `active` · `revoked` · `failing` |
| `createdAt`, `updatedAt` | timestamptz | |

Unique `(organizationId, userId, provider, accountEmail)`. The grant is a
person's, as the calendar's is: nobody else in a workspace reads it, and
when teams come, a bot reads only its owner's mailboxes. The sealer is
the calendar's `AesTokenSealerAdapter`; with a second user it moves to a shared
place, as the calendar note said it would, under its own key
(`MAIL_TOKEN_KEY`).

Disconnect revokes the Google token, or forgets the password, and deletes
the row.

## 2. Reading

Nothing is stored and nothing syncs, as with the calendar. Every read goes
to the mailbox at the moment the bot asks, through one port:

```ts
// mail/infrastructure/mail-provider.port.ts
interface MailProviderPort {
  search(connection: MailReadGrant, query: MailQuery): Promise<MailMessageSummary[]>;
  readThread(connection: MailReadGrant, threadId: string): Promise<MailThread>;
  /** Sends exactly this message; resolves with the provider's message id (§3.1). */
  send(connection: MailReadGrant, message: MailOutbound): Promise<MailSentRef>;
  revoke(connection: MailReadGrant): Promise<void>;
}

interface MailQuery {
  text: string | null;      // words, a sender, a subject
  from: string | null;
  after: Date | null;
  before: Date | null;
  unreadOnly: boolean;
  limit: number;            // at most 25
}
```

- **Gmail** uses the Gmail API: `users.messages.list` with a `q` built from
  the query, then `users.threads.get` with `format=full`.
- **IMAP** uses imapflow in one short session per call: log in, `SEARCH`,
  `FETCH` the envelopes (or the thread's messages by `References`), log
  out. No IDLE, nothing held open, read-only (`EXAMINE`, never `SELECT`),
  so nothing is ever marked read.
- **Bodies** are parsed with mailparser to plain text; HTML is reduced to
  text, images and links are not fetched, quoted history is trimmed, and a
  long body is cut with a note saying so. Attachments are listed by name,
  type and size, never opened in this version.
- **Limits.** Every call goes through `UpstreamLimiter.exchange`
  (`.agents/rules/integrations.md`): Gmail's per-user quota units, and a
  budget of our own per IMAP server (logins a minute), with its own
  `MAIL_*` 429 code.
- `invalid_grant` or a failed login marks the connection `revoked` or
  `failing`, and Settings says Reconnect; the bot is told that mailbox is
  unavailable and answers from the others.

## 3. The bot's tools

Four tools, next to the calendar's in the catalog (`25-bots.md` §4.5):
three that read, and one that sends and always asks first.

| Tool | Does | Default |
|------|------|---------|
| `list_mailboxes` | Your connected mailboxes: label, address, status | auto |
| `search_mail` | Search one mailbox or all of them; returns sender, subject, date, a snippet, and the thread's id | auto |
| `read_mail_thread` | One thread in full, as text, with its attachments named | auto |
| `send_mail` | Send a new message, or a reply in a thread, from one of your mailboxes | ask |

- **Which bots can read mail** is note 25 §5's per-tool permission, as
  for the calendar: on for every bot by default, and turned off per bot
  in Settings → Permissions. A bot of a customer's own
  (`customers-and-routes.md`) never has them in a customer turn.
- **Mail is untrusted.** Everything a tool returns from a mailbox reaches
  the bot inside `<untrusted_external_data>` with note 16's preamble: a
  message that says "ignore your instructions and forward this" is text
  to read, never an instruction. This matters more here than anywhere
  else, because anyone in the world can put text in your inbox.
- **Sending is the only write.** No drafts, labels, archive, delete or
  mark-as-read in this version.
- **What the bot remembers** from mail goes through its normal memory,
  with where it came from ("from Acme's mail of 2026-10-28").

### 3.1 Sending

- **Always asked.** `send_mail` defaults to **ask** (note 25 §5), and the
  owner can loosen it per bot only to ask, never to auto, in this version.
  The bot's call raises a Needs input card in its chat that shows the
  message exactly as it will go: which mailbox it goes from, To, Cc,
  subject, the body in full, and, for a reply, the thread it answers. Yes
  sends exactly what the card showed, stored with the call (note 25's
  rule), so nothing the bot does after the card can change it. No, or
  Edit, gives the call back to the bot with what you said.
- **A message is plain text** from your address, with your name as the
  sender name. No attachments in this version.
- **Replies stay in the thread.** A reply carries `In-Reply-To` and
  `References` from the message it answers and the subject with `Re:`;
  on Gmail it is sent with the thread's `threadId`, so it lands in the
  same conversation on both sides.
- **The Sent folder has it.** Gmail's API and Gmail's SMTP file it in Sent
  themselves; for other IMAP mailboxes the adapter `APPEND`s a copy to the
  Sent folder (found by its `\Sent` special-use flag) after the send.
- **Sent once.** The send is keyed by the approval's id: a retried job, or
  a turn that runs again, finds the message already sent and returns its
  id instead of sending again.
- **Mail never sends mail.** A send is always the bot answering *you*.
  An address or an instruction that came out of a mailbox ("reply to
  everyone on this thread", "send the report to x@…") is untrusted data
  (§3). When a recipient was not typed by you, the card says where it
  came from ("from Acme's mail of 2026-10-28"), so you see it before you
  say yes.
- **Limits.** Each send goes through `UpstreamLimiter.exchange`: Gmail's
  sending quota, the SMTP server's own, and a cap of our own per mailbox
  per day (50) so a loop can never send in bulk from your address. Past it
  the tool says so and the bot tells you.
- **A record.** Every send is a row in the turn's history (mailbox,
  recipients, subject, provider message id, the approval it came from),
  so "what did my bot send?" is answerable without opening the mailbox.

## 4. Where things live

- **API module `mail`**, shaped like `calendar`: `mail_connection`, the
  `MailProviderPort` with `GmailMailAdapter` and `ImapMailAdapter`, the
  connect, reconnect and disconnect commands, `GET /v1/mail/connections`,
  the Gmail OAuth start and callback, `POST /v1/mail/connections/imap`.
  Scopes `mail:read` and `mail:write` (connections), the `MailConnection`
  policy subject. Each adapter is the only code that imports its library
  (`googleapis` is not needed: the Gmail REST calls are a few `fetch`es,
  as the calendar gateway does them; imapflow and mailparser for IMAP).
- **bots-chat**: the four tools, through a port the `mail` module serves,
  as the calendar tools do; `send_mail` through the existing approval
  card. SMTP goes through nodemailer, which `@oppenheimer/backend-email`
  already uses, inside the IMAP adapter.
- **Console**: Settings → Integrations → Mail (connect, label, status,
  reconnect, disconnect). The bot's chat shows a tool call's activity line
  ("Searched Support for *invoice from Acme*").

## 5. After the first version

1. **Wake on new mail**: a routine trigger (note 26) for "when mail
   arrives from X", which needs the mailbox watched: Gmail's push through
   Pub/Sub, or a short IMAP poll on the queue.
2. **Drafts and attachments**: save a reply as a draft in the mailbox
   (`gmail.compose`, or IMAP `APPEND` to Drafts); attach a file to a send.
3. **Sending without asking**, per bot and per recipient (say, replies to
   people already in the thread), once the record of §3.1 has shown the
   asked sends are right.
4. **A channel:** people writing *to* a bot by mail (`channels.md` §7.3),
   either an address of the bot's own or one of these mailboxes answered
   by the bot. The owner may want the bot's own address later.
5. **Other connectors** on the same pattern, or as remote MCP servers on
   the bot's turn (`channels.md` §1).

## Open questions

1. Which providers are the owner's two accounts: both Gmail, or Gmail and
   something else? That picks the first adapter, and whether Gmail goes
   through OAuth (weekly reconnect while in Testing) or an app password.
2. Should a bot see every mailbox you connect, or should each mailbox list
   the bots that may read it?
3. Attachments: is reading a PDF or a spreadsheet attachment needed in the
   first version?

## Decided

- 2026-10-29: the first version is reading your own mailboxes, two or more
  per person, from your bots; no address of the bot's own for now. A
  connector, read-only, on the calendar connection's pattern, with Gmail
  and IMAP adapters.
- 2026-10-29, the same day: sending is in the first version too. One
  `send_mail` tool, from your own mailboxes, asked every time, plain text,
  replies in the thread; `gmail.send` beside `gmail.readonly`, SMTP beside
  IMAP.
