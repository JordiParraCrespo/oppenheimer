---
title: Inbox
description: The Inbox in Plan, what lands there (waiting or failed sessions, bot approvals, review requests, mergeable pull requests, failed automation runs, notices from sessions and bots), what you can do with each item, filters, unread, snooze and done, and how agents and bots post to it.
sidebar_position: 8
---

The **Inbox** is one list of what needs you. It is the first item of **Plan** (Plan → Inbox), and the console opens on it unless you dragged another rail item to the top. Plan's sidebar shows its count.

It looks like a mail client: a list column (search, unread rows with the sender, a subject and a line of body) beside a reading pane with a toolbar and the item as a message. On a phone the list fills the screen until you open an item.

## What lands there

Items are not stored: an item is there while its source says it needs you, and leaves when it no longer does.

| Item | From | When | What you can do |
| --- | --- | --- | --- |
| A session waiting on you | Sessions | its agent has been blocked 30 seconds or more, it failed to start, or it has been starting for over a minute | **Open session**. An agent's permission prompt or multiple-choice question can be answered right in the Inbox (**Send answers**); your answer is typed into its terminal |
| A bot approval | Bots | a bot stopped on a tool set to ask | **Approve**, **Deny**, or **Open chat** |
| A review request | Pull requests | someone asked for your review | **Open**, **View on GitHub** |
| A pull request ready to merge | Pull requests | your pull request has nothing holding it | **Merge**, **Open**, **View on GitHub** |
| A failed automation run | Automations | a run failed in the last 24 hours | **Run again**, **Open run** |
| A session's notice | an agent in a session | the agent ran `runner sessions notify "…"` | **Done** |
| A bot's notice | a bot | the bot used its `notify` tool | **Open chat**, **Done** |

A session or bot keeps one notice at a time: a newer one replaces the last. Questions a bot asks you with a question card are answered in its chat, not in the Inbox.

The list is newest first across every kind; deprioritized items sort last and read **Low**. Every item carries the project it belongs to, for the project filter.

## Acting on items

The reading pane's toolbar and each row's menu:

| Action | Effect |
| --- | --- |
| **Mark as done** | Hides this occurrence. It shows under **Show done** for the rest of your visit. |
| **Deprioritize** / **Restore priority** | Sorts it last, labelled Low, or puts it back. |
| **Snooze 1 hour** / **Snooze until tomorrow** | Hides it until then, in **Snoozed** with **Bring back**. |
| **Delete** | Hides this occurrence for good. |

A mark applies to one occurrence: if the same session blocks again later, or new commits land on a pull request, the item comes back.

**Unread** is kept per item in this browser: an item is read once shown in the reading pane. It does not sync between devices.

**Filters**: Type (All, Pull requests, Bots, Sessions, Automations), Project, Show done, and a search over sender, subject, body and source.

When nothing needs you, the pane says so and counts the sessions still running.

## Posting to the Inbox

- **An agent in a session** runs `runner sessions notify "The migration ran; all tests pass"` (one line, at most 500 bytes). Use it when the agent finishes something you asked to hear about, or needs you while you may not be watching. A bot that follows that session is woken by the notice too.
- **A bot** calls its `notify` tool: one line, at most 500 characters, for a bot whose chat nobody is watching (a routine's result, a long goal).

## Notifications elsewhere

There are no push notifications or emails for Inbox items. Oppenheimer emails you only for account and security events, such as a newly paired host or a host connecting from a new country or network. The Oppenheimer Chrome extension tracks your Claude Code cloud sessions and tells you which need you.
