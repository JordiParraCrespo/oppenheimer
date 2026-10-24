# Customers and routes: which bot answers, per customer and channel

**Goal:** bots talk to customers, not only to their owner. A message
arriving on any channel is matched against **routes** the workspace sets
up: "Slack goes to Iris", "WhatsApp goes to Milo", "Acme on WhatsApp goes
to Acme's own bot". The route picks the bot, and the bot answers there.

This builds on [Channels](channels.md), which connects WhatsApp, Slack and
email to a bot and decides how a message becomes a turn. That design binds
one channel account to one bot and holds every stranger for the owner.
This note replaces that binding with routes and adds the customer as the
other side of a conversation. The owner asked for it on 2026-10-24:
customer support and attendance (attending to customers) over email,
WhatsApp and Slack, routed per customer, with some WhatsApp customers each
getting a bot of their own. The research is
[`../research/lessons-from-channel-gateways.md`](../research/lessons-from-channel-gateways.md),
whose §9 reads OpenClaw's bindings, the same idea in a config file.

## 1. Two questions, kept apart

Channels answer **may this sender reach us at all**. Routes answer
**which bot answers them**. OpenClaw keeps the same split: "Bindings only
pick the agent. They do not create channel accounts and they do not grant
access." A route never lets in a sender the account would have held, and
an account never picks a bot.

What an account admits is its **audience**, chosen when it is connected:

- **Owner** (the default, channels.md §5): the owner and their allowed
  contacts; anyone else is held.
- **Customers**: anyone who writes is admitted, and routes decide what
  happens, including holding them. A support number or mailbox is this.

```
 inbound ─► intake row ─► admitted? ── no ─► held (channels.md §5)
                              │ yes
                              ▼
                    customer = identity lookup (§2)
                              │
                              ▼
          conversation exists? ── yes ─► its bot (routes apply to new ones)
                              │ no
                              ▼
                     resolveRoute (§3) ─► bot │ a person (§6) │ held
```

## 2. Customers

A **customer** is who is on the other side: a company or a person the
workspace serves. It has a name, notes, and **identities**, the ways it
shows up on channels:

| Channel | Identity | Matches |
|---|---|---|
| WhatsApp | A phone number, E.164 | That number, in a DM |
| WhatsApp | A group id | That group |
| Email | An address | That address, with a passing DMARC |
| Email | A domain | Any address at it, with a passing DMARC for it |
| Slack | A team id (Slack Connect, or their workspace with our app) | Anyone in that team |
| Slack | A channel id | That channel |

- `customer`: workspace, name, notes, created and archived timestamps.
- `customer_identity`: customer, channel kind, identity kind, value,
  unique on `(workspaceId, kind, identityKind, value)`, so one number
  belongs to one customer. The lookup is the most specific identity that
  matches: an address beats its domain, and a channel beats its team.
- A sender with no identity is **no customer**. The default route decides
  what happens to them (§3), and the console offers "Make a customer" on
  their conversation, which adds the identity.

One customer across channels is one customer: Acme writing from
`ops@acme.com` and from +34 600… is the same `customerId` on both
conversations, the way OpenClaw's `identityLinks` merge one person's
peers. The conversations stay separate, one per chat or thread
(channels.md §4); what is shared is the customer, and the memory of §5.

## 3. Routes

A route is a row: what it matches, and what answers.

| Field | Meaning |
|---|---|
| `kind` | The channel kind, or any |
| `accountId` | One connected account, or any of that kind |
| `customerId` | One customer, or any, or **none** (a sender who is no customer) |
| `conversationId` | One conversation (a Slack channel, a WhatsApp group), or any |
| `target` | `bot` (with `botId`), `person` (straight to the inbox, §6), or `hold` |
| `instructions` | Optional lines added to the bot's prompt for turns on this route |

**The most specific route wins**, by a fixed order of tiers, never by the
order rows were added:

1. The conversation.
2. The customer (or "none") on this channel kind (and account, if set).
3. The customer (or "none") on any channel.
4. The account.
5. The channel kind.
6. The workspace default.

Within a tier the account narrows before it widens: a route with an
account beats the same route without one. Two routes in the same tier
with the same match cannot exist: a unique index on the match columns
refuses the second, so there is no tie to break. OpenClaw breaks ties by
config order, which is how one rule silently shadows another; a table
with an edit form has no order to lean on, so it gets the constraint
instead.

`resolveRoute(inbound, customer, routes)` is a pure domain policy that
returns the route and the tier that matched (`matchedBy`, as OpenClaw
records it), so the console can say why a conversation went where it did.

**Your example, as rows:**

| Kind | Account | Customer | Conversation | Target |
|---|---|---|---|---|
| WhatsApp | | Acme | | Acme's bot |
| WhatsApp | | Globex | | Globex's bot |
| WhatsApp | | | | Milo (front desk) |
| Slack | | | | Iris (support) |
| Email | support@ | | | Iris (support) |
| Email | billing@ | | | person |
| Email | | none | | hold |

Acme on WhatsApp reaches its own bot (tier 2); Acme by email reaches Iris
(tier 4, since Acme has no email route); an unknown WhatsApp number
reaches Milo (tier 5); an unknown sender by email is held, because
"none" counts as a customer value and its route (tier 2) beats the
mailbox's (tier 4).

**A conversation keeps its bot.** The route is resolved once, when the
conversation opens, and written on it. Editing a route changes where new
conversations go; an open one moves only when someone presses **Reroute**
on it, which resolves again. A customer mid-conversation never finds a
different bot answering.

**No route, no answer.** A workspace with channels and no default route
holds what nothing matches, the channels.md default. The console's first
route is offered when the first account is connected: "Send everything on
this number to Juno", which is the binding channels.md had.

## 4. A bot of a customer's own

A bot dedicated to one customer is an ordinary bot (note 25) with routes
that send only that customer to it. Nothing new is built for it, and that
is the point: its `INSTRUCTIONS.md`, its documents and its memory are its
own, so what it knows about Acme was only ever learned from Acme.

- **Created from the route form**: "New bot for Acme" makes a bot named
  after the customer, with its `INSTRUCTIONS.md` started from the bot the
  channel already routes to, if any (a copy, not a link), and adds the
  route.
- **The sidebar groups it** under a group per customer, using bot groups
  as they are.
- **A dedicated bot can still take other routes.** Nothing stops it; the
  route list shows every bot's routes, so a bot serving two customers is
  visible.

## 5. A shared bot serving many customers

Iris answering every Slack customer must not tell Globex what it learned
from Acme. Note 25 has one memory per bot, shared by every conversation
(channels.md §4, as dots does). Customer turns change that:

- **Facts carry who they came from.** `bot_memory_fact` gains a nullable
  `customerId` and a nullable `conversationId`. A fact remembered in a
  customer's turn carries that customer. A fact remembered in a turn
  from a sender who is no customer yet (§2) carries the conversation
  instead, never neither. Only a fact remembered in the console or by
  the owner carries neither, and only those are the bot's own.
- **A turn reads** the bot's own facts, plus that customer's, or that
  conversation's when the sender is no customer. Never another
  customer's or another stranger's.
- **Making a customer** from a conversation moves its facts to the
  customer (`conversationId` cleared, `customerId` set), in the same
  transaction that adds the identity.
- **Documents** (`SOUL.md`, `INSTRUCTIONS.md`, knowledge) are the bot's
  and shared: they are what the owner wrote, not what customers said.
- **Writing to a shared document from a customer turn asks.** A customer
  cannot teach the bot something every other customer then hears.

## 6. What a customer may make a bot do

Channels.md §5 has every non-owner's message act inside the owner's
permissions. With customers that is too much: a customer must not be able
to start a session on the owner's host or read their pull requests.

- **A customer turn has its own tool set**, narrower than the bot's.
  By default: answer, read the bot's documents and knowledge, remember (for
  this customer, or this conversation, §5), look up and update the customer's record, and hand off.
  Sessions, GitHub, the plan, other bots and `send_message` elsewhere are
  **blocked** in a customer turn, whatever the bot's permissions say.
  The owner can allow more per route (a route's tools list), never more
  than the bot itself has.
- **A customer's message is a request, not an instruction**, and is never
  a way to approve anything; the turn context says who is writing and that
  they are a customer, beside the route's `instructions`.
- **The owner on a channel is still the owner**: their own number, Slack
  user or address keeps channels.md's rules, whatever route the
  conversation took.

## 7. Handing off to a person

Support needs a way out of the bot.

- **`hand_off`** is a tool a customer turn always has: the bot says what it
  could not do, the conversation becomes **Waiting for a person**, the bot
  stops answering it, and the customer gets one line saying someone will
  reply. The route's `target: person` opens the conversation that way.
- **The inbox** in the console lists conversations waiting for a person,
  oldest first, with the customer, the channel and the bot's note. A
  person replies from the console, and the reply goes out through the same
  channel account, under the account's identity (the number, the Slack
  app, the address) with their name where the channel shows one.
- **Back to the bot** is a button; until it is pressed, new messages wait
  in the inbox, not for a turn.
- **The workspace is personal** (CLAUDE.md, note 08), so "a person" is the
  owner for now. Teams, assignment and an inbox per person come with teams.

## 8. Channels with customers on them

The three channels keep their design; what changes is who writes in.

- **WhatsApp.** The linked device of a spare number (channels.md §7.1) is
  fine for a handful of known customers who write first. Many strangers
  and many new chats a day is the pattern that gets an unofficial client's
  number banned, and a support number is one you cannot lose. So
  customer-facing WhatsApp gets a **second implementation of the same
  port**: the WhatsApp Business Platform (Cloud API), a `pushed` channel
  through Meta's webhook. It brings what the linked device does not have:
  a verified business name, no ban risk for following the rules, and
  Meta's own rules: a 24-hour window after the customer's last message,
  templates outside it, and per-conversation pricing. Meta's §4.7 bars
  providers whose AI is the primary function of their use of the Platform,
  aimed at general-purpose assistants like ChatGPT's number; a business
  answering its own customers is the use the Platform is for. Which of the
  two a number uses is chosen when it is connected, and routes do not
  care.
- **Slack.** Customers on Slack are a Slack Connect channel shared with
  them, or their own workspace with our app installed. The customer
  identity is the team or the channel (§2). The one-app design and its
  per-message bot name and icon (channels.md §7.2) already cover a bot per
  customer.
- **Email.** A support mailbox, connected as channels.md §7.3 has it. The
  customer is found by address or domain, with DMARC. `support@` and
  `billing@` are two accounts, so they can route differently.

## 9. Where things live

- **`channels` module**: `customer`, `customer_identity`, `channel_route`,
  and the `resolveRoute` policy in its domain; `channel_conversation` gains
  `customerId`, `routeId`, `matchedBy` and a `handling` state (`bot`,
  `waiting_for_person`). `channel_account` loses its `botId`: the route is
  the binding. Scopes `channels:read` and `channels:write` cover routes;
  customers get `customers:read` and `customers:write` and the `Customer`
  policy subject.
- **bots-chat**: the customer tool set and the per-customer memory read;
  `hand_off`.
- **Console**: Customers (a list, each with identities, conversations and
  the bots that serve them); Settings → Channels → Routes, a table with a
  "Test a message" box that shows which route a given sender would hit and
  why; the inbox.

## 10. Slices

These come after channels.md slice 1 (the core and WhatsApp to one bot).

1. **Routes.** `channel_route` with the tiers, the account's `botId` moved
   to a route, the route resolved when a conversation opens. Customers
   with identities. A bot of a customer's own works from here.
2. **Customer turns.** The narrow tool set, memory per customer,
   instructions per route.
3. **Hand-off and the inbox.**
4. **WhatsApp Business Platform** as the second WhatsApp channel.
5. Email and Slack as in channels.md, with customers.

## Open questions

1. "Attendance" was read as attending to customers: a front desk that
   answers, books and hands off. If it also means staff attendance
   (clocking in and out, absences), that is a separate bot and note.
2. Does a customer need a portal or a web chat widget as a fourth
   channel, or are email, WhatsApp and Slack enough?
3. Bookings: is the front desk's calendar the workspace's (note 20) or a
   per-customer one?
4. Should a customer's identities be created by the bot (it asks for an
   email on WhatsApp and links them), or only by the owner?
5. Per-route business hours: should a route have hours, with a different
   target outside them?

## Decided

- 2026-10-24: the owner asked for bots that talk to customers over email,
  WhatsApp and Slack, routed per customer and channel ("when a message
  comes from Slack do this, from WhatsApp the other thing"), with some
  WhatsApp customers each on a bot of their own. Routes replace the
  account's single bot; the most specific route wins, by tier.
