---
title: Routines and watches
description: How a bot works when nobody writes to it, routines on a schedule, on a GitHub or Gmail event or on a webhook, its heartbeat, quiet runs, loops and goals, watches on sessions and pull requests, the stall check, the regular look at work in progress, and the full list of what wakes a bot.
sidebar_position: 6
---

A bot only runs when something gives it a **turn**. Your message is one. This page covers the others: routines, loops, goals and watches. Every one of them is a queued turn of the bot, runs as you with the bot's permissions as they are at that moment, and shows in the chat as a line saying why it ran. A routine's run is the exception: it has no line, so the bot's message reads as the bot coming back to you on its own.

## Routines

A **routine** is an automation whose run is a turn of the bot instead of a session. It lasts until deleted and runs whether or not the chat is open. Routines are listed on the bot's **Routines** tab and on **Automations** with the bot that runs them.

Triggers a routine can have:

| Trigger | Examples |
| --- | --- |
| Schedule | Once on a date, hourly, daily, weekdays, weekly on chosen days, monthly, in your time zone; or a custom schedule the bot writes from your words, for what those cannot say: several times a day, every 15 minutes during work hours, the last weekday of the month, the second Tuesday. A custom schedule fires at most every five minutes, and the Routines tab says it in words |
| GitHub event | Pull request opened, pushed or merged, check failed, checks passed, review submitted, comment, issue opened, label added, mention, push, release (on repositories the GitHub App covers) |
| Gmail | Mail received in a connected Gmail account, optionally matching a search |
| Webhook | Anything posted to the routine's own URL: a deploy pipeline, Sentry, a form, a home-automation hub |

**Making one**: ask the bot in chat ("every weekday at 9, check open PRs and tell me which need me"), or type `/schedule` followed by the request. The bot saves it with its routine tool. A save asks you first with a card, except a create from your own `/schedule` command, which is the consent. Changing, deleting or running a routine from the chat asks too.

**The Routines tab** shows each routine's name, when it runs (or Paused) and its last and next run, with a switch, **Run now**, **Edit routine** and **Delete**. Edit routine opens a dialog where you change its name and prompt yourself; to change when it runs, its **Ask in chat** puts "Edit your routine: …" in the composer for the bot to change it. Using the tab yourself raises no card.

A routine is skipped and paused when it cannot run, with the reason in the chat: the bot's provider has no key, its owner lost access, or an hourly run limit was hit (10 runs an hour per routine, 100 per workspace by default). A run due while the last one is still running is skipped.

**The heartbeat.** A bot can have one routine of its own named **Heartbeat**. Each run the bot rereads its instructions and the plan, looks at the sessions, pull requests and mail it looks after, acts on what needs it and tells you what you must know; when nothing does, it stays quiet. No bot is given one by default: ask the bot for one in chat. A Heartbeat a bot already had was moved to twice a day, 09:00 and 18:00 in your time zone, and paused; turn it back on from the Routines tab, and change its times there or in chat like any routine. A beat with nothing new in the bot's chat since the last one (another routine or a loop does not count) is skipped without calling the model, so a quiet bot spends nothing. Run now always runs it. Events (a pull request it watches, new mail, a session it follows) still wake the bot at any hour.

**Quiet runs.** A turn nobody is waiting on (a routine, a wake, a goal, a loop) can end with nothing to report: the chat shows only a collapsed line, and you get no message. A routine's quiet run shows nothing at all, unless the chat is set to show tool calls.

**While you're away.** Routines keep running on their schedule whether or not you read what they say; nothing pauses them because you have not opened the chat. To stop one, pause it on the Routines tab or ask the bot.

Mail older than two days, spam, trash and chats never wake a Gmail routine; email and event text reach the bot marked as outside data, never as instructions.

## Webhooks

A routine with a **webhook** trigger runs whenever something is posted to its URL. Ask the bot for one in chat ("when our deploy pipeline posts here, tell me if it failed"); it adds the trigger, and you make the URL yourself: the bot never sees it.

**Making the URL.** On the bot's **Routines** tab, the routine shows a Webhook row under its card. **Create URL** makes it. Tick **Require a signature** to also get a signing secret. The URL and the secret are shown once, so copy them then; afterwards the row shows only the start of the URL, whether it is signed, and when something was last posted. **New URL** replaces it (the old one stops working at once), and **Revoke** turns it off while keeping the trigger. Removing the webhook trigger in chat removes the URL too. On a deployment that sends email, making a URL needs a verified email address: until you open the link in the verification email, it is refused with "Verify your email address first" and a **Resend verification email** button, for when the first link has expired (after an hour) or never arrived.

**Posting.** Send a `POST` with any body and content type. The answer is `202` with the run's id (`runId`) and `status`: `queued`, `skipped` (an hourly cap turned it away; the run says so) or `duplicate`. It never waits for the bot. Send an `Idempotency-Key` header and a retried request with the same key is the same run.

```bash
curl -X POST "https://…/api/v1/routine-webhooks/owh_…" \
  -H "Content-Type: application/json" \
  -d '{"deploy":"web","status":"failed"}'
```

**Signing.** A signed URL takes only requests with an `x-oppenheimer-signature` header of the form `t=<unix seconds>,v1=<signature>`, where the signature is the hex HMAC-SHA256 of `<t>.<body>` (the timestamp, a dot, then the exact body) with the signing secret. A request more than five minutes old or new is refused, so a captured request cannot be replayed later.

```bash
t=$(date +%s); body='{"status":"failed"}'
sig=$(printf '%s.%s' "$t" "$body" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -X POST "$URL" -H "x-oppenheimer-signature: t=$t,v1=$sig" -d "$body"
```

**What the bot gets.** The first 16 KiB of the body (up to 256 KiB is accepted) and its content type, kept with the run and handed to the bot as outside data, never as instructions. The routine's own prompt says what to do with it.

**When it is refused.** An unknown, replaced or revoked URL is `404`; a missing, stale or wrong signature `401`; a body over 256 KiB `413`; a paused routine `409`. The hourly limits, a run still going and a provider with no key apply as for any routine.

## Loops

`/loop` is for watching something now, in this chat: `/loop 5m check the deploy` runs the prompt at once and then every 5 minutes (1 minute to 1 day). Without an interval the bot picks when to run next, 1 to 60 minutes ahead. A bot has one loop at a time. It ends after 3 days, when you press Stop or type `/loop stop`, when the bot decides it has served its purpose, or when a run fails in a way the next would too. Use `/schedule` for a habit, `/loop` for minutes.

## Goals

A goal keeps a bot going across turns until a condition holds: you type `/goal <condition>`, or the bot sets one itself. After each turn a reviewer on the bot's model judges it met, not met or impossible without you; not met queues the next continuation. Your goals get up to 20 continuations, the bot's 5 unless it asks for more. Stop above the composer or `/goal clear` ends it. A goal waits out a provider's rate limit and says until when.

## Watches

A **watch** (a subscription) makes a bot hear back from work it does not own the clock of.

**Sessions.** When a bot starts a session it follows it by default. It can also watch any session (`watch_session`): until the current task ends, or until the session closes. A watched session wakes the bot when its task:

| Event | The bot is asked to |
| --- | --- |
| Needs input (a permission, a question) | tell you what it waits on and where |
| Completes | read what it did and report it |
| Fails | say so and why |
| Is stopped or closed | say it was stopped, without restarting it |
| Expires before running | say so |

A watch can also wake on a line the terminal prints that matches a pattern; the match is made on the host and only a count reaches Oppenheimer, so the bot reads the session to see what happened. A notice the session's agent sends with `runner sessions notify` wakes every bot that follows it. Each wake fires once per state per task. A watch ends after 20 wakes; a bot holds at most 50 watches.

**The stall check.** Five minutes after a bot starts a session or sends one a prompt, Oppenheimer checks once whether the task never started or its agent was never seen working (an offline host, an agent stuck at a sign-in). If so the bot is woken once to tell you what looks stuck. It does not restart or prompt the session on its own.

**Looking at the work.** While that task keeps running, the bot looks at it again every ten minutes, for up to an hour: it reads what the agent has done against the task it gave. When the work is on track it says nothing, and the chat shows only "Checked on session …". When the agent has gone idle without finishing, is going in circles or off the task, waits on something or hits an error, the bot tells you, and it may nudge the agent when its instructions cover what the agent needs. Ask it "how is it going?" and it looks right away.

**Checking back.** For anything else it waits on (a deploy, a pull request, someone's answer), a bot sets its own look with `check_back`: at a time it names, or backing off from 5 minutes to every 2 hours, for a day at most. Each look reads "Checked back on: …".

**Waiting inside a turn.** A bot can also wait up to 120 seconds inside one turn for a session to need input or end, at most three times a turn.

**Pull requests.** `watch_pull_request` follows an open pull request on a repository you can read. A check failing or passing, a review, a comment or the merge wakes the bot with the event's facts (kind, number, check name, reviewer's login), never anyone's words; the bot reads the pull request itself. The merge ends the watch. A pull request closed without merging does not end it yet.

**Projects and milestones.** `watch_project` follows every task of a project, and `watch_milestone` the tasks under one milestone. By default a task being added, moving column, being done or reopened, blocked or unblocked, or deleted wakes the bot; ask it to follow other changes too (a new due date, a task moved to another project, a session attached). The bot is told which task, what changed and whether you did it, never the task's notes, and its own changes never wake it. It follows until it unwatches, with no limit on wakes. "Tell me when anything on Web is blocked" is enough. The chat draws a line for each task update only while the wrench (show tool calls) is on; with it off you see only what the bot says about them, and a wake it had nothing to say to leaves no trace.

Ask a bot "what are you watching?" and it lists its watches. There is no list of them in the bot's settings yet; every wake is a line in the chat, except a project's or milestone's task updates, which show only with the wrench on.

## Everything that wakes a bot

| Source | Turn opened by |
| --- | --- |
| Your message, or a decision on its approval or question card | you |
| Another bot's message or ask, or the answer to its own ask | that bot |
| A routine's schedule, GitHub event, Gmail mail or webhook, or Run now | the routine |
| A loop's run, a goal's continuation | the loop or goal |
| A watched session or pull request, a session's notice, the stall check, the regular look at a running task | the watch |

Turns run one at a time per bot: your messages first, then other bots', then background work (routines, loops, wakes).

## Not available yet

Spreading the run times of routines other than the heartbeat, routines triggered by a session ending, webhooks on plain automations (sessions), and WhatsApp or Telegram messages as a trigger.

