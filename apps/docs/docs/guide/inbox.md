---
title: Inbox
description: The Inbox, the console's first rail item, what lands there (waiting or failed sessions, bot approvals, review requests, mergeable pull requests, failed automation runs, notices from sessions and bots, reports with pictures from any agent, tasks an agent made), what you can do with each item, filters, unread, snooze and done, and how agents and bots post to it.
sidebar_position: 8
---

The **Inbox** is one list of what needs you. It is the first item of the rail, with a dot and a count while anything needs you, and the console opens on it unless you dragged another rail item to the top. It has no sidebar: the list and the deck take the whole window.

It looks like a mail client: a list column (search, unread rows with the sender, a subject and a line of body) beside a deck: the item in hand as a card on the stack of what is left, with only its answers, and under it **Previous**, **Done** and **Next**. Over the deck, "3 of 12" and a line that fills as you clear the visit. On a phone the list fills the screen until you open an item.

## Going through it fast

The deck is made to clear the Inbox one card after another:

| Keys | What they do |
| --- | --- |
| **1**–**9** | Press the card's answer with that number (Yes, Approve, Merge, Send answers, an option of a question…). Each answer shows its number. |
| **E** | **Done**: puts the card away. The card goes off to the right. |
| **J** / **→** and **K** / **←** | **Next** and **Previous**: move through the stack without acting on anything. |

On a phone or tablet, swipe a card **right** for Done or **left** for Next. Once a card is answered or put away, the next one takes its place, and the clear deck says how many you cleared.

**Done is not offered while something waits on your answer**: a session whose agent asked a permission or a question, and a bot stopped on an approval. Hiding those would leave the agent stuck, so they leave the deck only when you answer them (or answer in the session itself: **Open session** is always the last answer).

A **questionnaire** (an agent's multiple-choice questions) goes one question at a time: pick an answer and the next question comes up; for a question that takes several answers, or one you answer in your own words, press **Next question**. After the last, every answer is listed, each one a way back to change it, and **Send answers** sends them all. Nothing reaches the agent before that.

## What lands there

Items are not stored, with one exception: an item is there while its source says it needs you, and leaves when it no longer does. The exception is a **report**, which an agent sends and Oppenheimer keeps until you answer it.

| Item | From | When | What you can do |
| --- | --- | --- | --- |
| A session waiting on you | Sessions | its agent is waiting on a permission or an answer (it shows within seconds), it failed to start, or it has been starting for over a minute | An agent's permission prompt or multiple-choice questions are answered right in the Inbox; your answer is typed into its terminal. **Open session** |
| A bot approval | Bots | a bot stopped on a tool set to ask | **Approve**, **Deny**, or **Open chat** |
| A review request (when shown) | Pull requests | someone asked for your review | **Open**, **View on GitHub** |
| A pull request ready to merge (when shown) | Pull requests | your pull request has nothing holding it | **Merge**, **Open**, **View on GitHub** |
| A failed automation run | Automations | a run failed in the last 24 hours | **Run again**, **Open run** |
| A session's notice | an agent in a session | the agent ran `runner sessions notify "…"` | **Open session**; **Done** once read |
| A bot's notice | a bot | the bot used its `notify` tool | **Open chat**; **Done** once read |
| A report | any agent with a token | it posted a problem, with up to four pictures | Write an answer and **Send answer**; the agent reads it. **Done** hides it without answering |
| A task an agent made | a bot, or an agent with a token (MCP, CLI) | it added a task to your board, and you have not taken it up | **Put on today**, **Start session**; **Done** keeps it on the board as it is |

Pull requests are off by default: agents open theirs under your GitHub account, so every one would wait here as yours to merge. Turn on **Show pull requests** in the filter menu to list review requests and ready merges; the choice is kept in this browser. The **Pull requests** page lists them either way.

A task an agent made leaves the Inbox once you take it up: you give it a TODO day (here or in its dialog), start or link a session on it, or mark it **Done** (or **Delete** it), which keeps it on the board as it is. Only you take a task up: a session or a TODO day an agent gives it leaves it waiting. A task you make in the console never lands here. Tasks made through the CLI or an API token count as an agent's, even when you typed the command.

A session or bot keeps one notice at a time: a newer one replaces the last. Questions a bot asks you with a question card are answered in its chat, not in the Inbox.

The list is newest first across every kind; deprioritized items sort last and read **Low**. Every item carries the project it belongs to, for the project filter.

## Acting on items

**Done** on the deck, and each row's menu in the list:

| Action | Effect |
| --- | --- |
| **Mark as done** | Takes this occurrence out of the list. Turn on **Show done** in the filter menu to see what you marked done on this visit, struck through. On a task an agent made, it also keeps the task on the board as it is. |
| **Deprioritize** / **Restore priority** | Sorts it last, labelled Low, or puts it back. |
| **Snooze 1 hour** / **Snooze until tomorrow** | Hides it until then, in **Snoozed** with **Bring back**. |
| **Delete** | Hides this occurrence for good. |

**Several at once**: **Select** in the list's head shows a checkbox on every row (or hover a row and check its box, or press **X** to check the item on the deck); Shift-click checks a run of rows. The bar that takes the list's head then marks every checked row done, deprioritizes, snoozes or deletes them in one go. **Esc** or the cross leaves selecting.

A mark applies to one occurrence: if the same session blocks again later, or new commits land on a pull request, the item comes back.

**Unread** is kept per item in this browser: an item is read once shown on the deck. It does not sync between devices.

**Filters**, in the list's filter menu: Type (All, Pull requests while they are shown, Bots, Sessions, Automations, Reports, Tasks), Project, Show done and Show pull requests; and a search over sender, subject, body and source.

When nothing needs you, the deck says so and counts the sessions still running.

## Posting to the Inbox

- **An agent in a session** runs `runner sessions notify "The migration ran; all tests pass"` (one line, at most 500 bytes). Use it when the agent finishes something you asked to hear about, or needs you while you may not be watching. A bot that follows that session is woken by the notice too.
- **A bot** calls its `notify` tool: one line, at most 500 characters, for a bot whose chat nobody is watching (a routine's result, a long goal).

- **Any agent with a token** sends a **report**: a problem with its pictures, which you answer in the Inbox. This is the way for an agent that is not in a session on one of your hosts, such as a scheduled routine in a vendor's cloud.

## Reports: a problem with pictures, and your answer

A report has a title, an optional body, the sender's name for itself, an optional link to where the problem can be seen, and up to four pictures (PNG, JPEG, GIF or WebP, 5 MB each). The agent needs an [API token](./cli-and-mcp.md) with the **Inbox reports** permissions (`inbox-reports:write` to send, `inbox-reports:read` to read the answer), pinned to your workspace as `opp tokens create` pins it; a token pinned to no workspace is refused with `TENANT_001`:

```bash
curl -sS -X POST "$OPPENHEIMER_API_URL/v1/inbox/reports" \
  -H "Authorization: Bearer $OPPENHEIMER_API_TOKEN" \
  -F title="Sign-up shows a blank page on a phone" \
  -F body="Opened /sign-up at 390 px wide; the form never renders. Should I fix it or is this known?" \
  -F source="qa-explorer" \
  -F link="https://github.com/acme/app/pull/123" \
  -F images=@before.png -F images=@console-error.png
```

The answer comes back on the report itself. The agent asks for it when it next runs:

```bash
curl -sS "$OPPENHEIMER_API_URL/v1/inbox/reports/<id>" \
  -H "Authorization: Bearer $OPPENHEIMER_API_TOKEN"
# "status": "answered", "answer": "Fix it, and add a test at phone width."
```

`GET /v1/inbox/reports?status=answered` lists every answered report, and `?status=open` those still waiting on you.

In the Inbox a report shows its pictures (select one to see it whole), its link, and a box for your answer. Once you send an answer the report leaves the Inbox; nothing is typed into a terminal and nobody is woken, so an agent that runs once a day sees your answer on its next run. A token that holds only the Inbox reports permissions cannot answer a report: answering takes the **Inbox** permission, which is yours.

## Notifications elsewhere

**In this browser.** Turn on **Notify me in this browser** in the Inbox's filter menu, and allow notifications when the browser asks. From then on, while the console is open in a tab you are not looking at, a session that comes to wait on you (a permission or a question its agent asks, or a session that failed) and a notice an agent sends each raise one system notification; a session whose turn ends (its row's dot goes blue) raises one too, and a session still waiting on you, or still blue, thirty minutes later raises one reminder. Clicking it brings the console forward on that session. The tab you are looking at raises none, since the Inbox already shows it. What was already waiting when you opened the console is not announced. To silence one session, choose **Mute notifications** in its row's menu in the sidebar (**Unmute notifications** turns them back on); like Mark as unread, it is kept in this browser, and a muted row shows a crossed-out bell. The switch is kept per browser; if the browser blocks notifications for Oppenheimer, the menu says so, and you allow them again in the browser's site settings.

There are no push notifications to a phone or emails for Inbox items. Oppenheimer emails you only for account and security events, such as a newly paired host or a host connecting from a new country or network. The Oppenheimer Chrome extension tracks your Claude Code cloud sessions and tells you which need you; connected to Oppenheimer (its popup's Oppenheimer section, with an API token that has `sessions:write`), it also raises a Chrome notification when a session on your hosts comes to wait on you or its agent sends a notice, checking every minute, and counts them on its badge. A click opens the session in the console.
