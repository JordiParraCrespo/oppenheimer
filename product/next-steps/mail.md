# Mail — your mailboxes, readable by your bots

**Goal:** connect two or more of your own mail accounts and let your bots
read them. "What did the accountant send last week?", "Summarise what
came in on the support inbox today", "Is there a reply from Acme?" are
answered from your real mail, in the bot's chat.

The owner set this as the first version on 2026-10-29, ahead of every
channel: no address of the bot's own for now, and nobody writes *to* the
bot by mail yet. In the words of [Channels](channels.md) §1 this is a
**connector**, not a channel: the bot reads mail **as you**, from accounts
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
  scope `https://www.googleapis.com/auth/gmail.readonly`, the API's own
  callback, the same `GOOGLE_CLIENT_ID`. The account is keyed by Google's
  `sub`. Connecting the same Google account for the calendar and for mail
  is two connections, granted and revoked separately.
- **Any other mailbox (IMAP):** server, port, user and an **app password**
  (Gmail with 2-Step, iCloud, Fastmail, Yahoo, most hosts), tested by
  logging in on save. The password is sealed like a refresh token. A plain
  account password is refused where the provider has app passwords.
- **Outlook / Microsoft 365** needs Microsoft's OAuth (Microsoft Graph,
  `Mail.Read`), since Microsoft no longer accepts passwords for IMAP on Outlook.com and Microsoft 365. It is
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
| `config` | jsonb | IMAP host, port, TLS, user; empty for Gmail |
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

Three tools, all read-only, next to the calendar's in the catalog
(`25-bots.md` §4.5):

| Tool | Does | Default |
|------|------|---------|
| `list_mailboxes` | Your connected mailboxes: label, address, status | auto |
| `search_mail` | Search one mailbox or all of them; returns sender, subject, date, a snippet, and the thread's id | auto |
| `read_mail_thread` | One thread in full, as text, with its attachments named | auto |

- **Which bots can read mail** is note 25 §5's per-tool permission, as
  for the calendar: on for every bot by default, and turned off per bot
  in Settings → Permissions. A bot of a customer's own
  (`customers-and-routes.md`) never has them in a customer turn.
- **Mail is untrusted.** Everything a tool returns from a mailbox reaches
  the bot inside `<untrusted_external_data>` with note 16's preamble: a
  message that says "ignore your instructions and forward this" is text
  to read, never an instruction. This matters more here than anywhere
  else, because anyone in the world can put text in your inbox.
- **Nothing goes out.** No send, no reply, no draft, no labels, no
  archive, no mark-as-read in this version. The bot answers in its chat.
  Drafting replies is the first thing after (§5).
- **What the bot remembers** from mail goes through its normal memory,
  with where it came from ("from Acme's mail of 2026-10-28").

## 4. Where things live

- **API module `mail`**, shaped like `calendar`: `mail_connection`, the
  `MailProviderPort` with `GmailMailAdapter` and `ImapMailAdapter`, the
  connect, reconnect and disconnect commands, `GET /v1/mail/connections`,
  the Gmail OAuth start and callback, `POST /v1/mail/connections/imap`.
  Scopes `mail:read` and `mail:write` (connections), the `MailConnection`
  policy subject. Each adapter is the only code that imports its library
  (`googleapis` is not needed: the Gmail REST calls are a few `fetch`es,
  as the calendar gateway does them; imapflow and mailparser for IMAP).
- **bots-chat**: the three tools, through a port the `mail` module serves,
  as the calendar tools do.
- **Console**: Settings → Integrations → Mail (connect, label, status,
  reconnect, disconnect). The bot's chat shows a tool call's activity line
  ("Searched Support for *invoice from Acme*").

## 5. After the first version

1. **Draft a reply**, saved as a draft in the mailbox (`gmail.compose`, or
   IMAP `APPEND` to Drafts), never sent; you send it from your mail app.
2. **Wake on new mail**: a routine trigger (note 26) for "when mail
   arrives from X", which needs the mailbox watched: Gmail's push through
   Pub/Sub, or a short IMAP poll on the queue.
3. **Send with approval** (`send_mail`, ask by default), from your own
   address.
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
