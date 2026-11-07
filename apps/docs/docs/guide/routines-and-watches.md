---
title: Routines and watches
description: How a bot works when nobody writes to it, routines on a schedule or on a GitHub or Gmail event, loops and goals, watches on sessions and pull requests, the stall check, and the full list of what wakes a bot.
sidebar_position: 6
---

A bot only runs when something gives it a **turn**. Your message is one. This page covers the others: routines, loops, goals and watches. Every one of them is a queued turn of the bot, runs as you with the bot's permissions as they are at that moment, and shows in the chat as a line saying why it ran.

## Routines

A **routine** is an automation whose run is a turn of the bot instead of a session. It lasts until deleted and runs whether or not the chat is open. Routines are listed on the bot's **Routines** tab and on **Automations** with the bot that runs them.

Triggers a routine can have:

| Trigger | Examples |
| --- | --- |
| Schedule | Once on a date, hourly, daily, weekdays, weekly on chosen days, monthly, in your time zone |
| GitHub event | Pull request opened, pushed or merged, check failed, checks passed, review submitted, comment, issue opened, label added, mention, push, release (on repositories the GitHub App covers) |
| Gmail | Mail received in a connected Gmail account, optionally matching a search |

**Making one**: ask the bot in chat ("every weekday at 9, check open PRs and tell me which need me"), or type `/schedule` followed by the request. The bot saves it with its routine tool. A save asks you first with a card, except a create from your own `/schedule` command, which is the consent. Changing, deleting or running a routine from the chat asks too.

**The Routines tab** is controls, not an editor. Each row shows the name, when it runs (or Paused) and its last and next run, with a switch, **Run now**, **Edit in chat** (puts "Edit your routine: …" in the composer for the bot to change it), and **Delete**. Using the tab yourself raises no card.

A routine is skipped and paused when it cannot run, with the reason in the chat: the bot's provider has no key, its owner lost access, or an hourly run limit was hit (10 runs an hour per routine, 100 per workspace by default). A run due while the last one is still running is skipped.

Mail older than two days, spam, trash and chats never wake a Gmail routine; email and event text reach the bot marked as outside data, never as instructions.

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

**Waiting inside a turn.** A bot can also wait up to 120 seconds inside one turn for a session to need input or end, at most three times a turn.

**Pull requests.** `watch_pull_request` follows an open pull request on a repository you can read. A check failing or passing, a review, a comment or the merge wakes the bot with the event's facts (kind, number, check name, reviewer's login), never anyone's words; the bot reads the pull request itself. The merge ends the watch. A pull request closed without merging does not end it yet.

Ask a bot "what are you watching?" and it lists its watches. There is no list of them in the bot's settings yet; every wake is a line in the chat.

## Everything that wakes a bot

| Source | Turn opened by |
| --- | --- |
| Your message, or a decision on its approval or question card | you |
| Another bot's message or ask, or the answer to its own ask | that bot |
| A routine's schedule, GitHub event or Gmail mail, or Run now | the routine |
| A loop's run, a goal's continuation | the loop or goal |
| A watched session or pull request, a session's notice, the stall check | the watch |

Turns run one at a time per bot: your messages first, then other bots', then background work (routines, loops, wakes).

## Not available yet

A "check-in" that stays silent when there is nothing to report, spreading routine times, a guard that pauses routines nobody reads, routines triggered by a session ending or by a webhook, and WhatsApp messages as a trigger.
