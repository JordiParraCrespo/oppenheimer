---
title: Bot skills and commands
description: A bot's skills (saved ways of doing a task, run as /<name>, saved by you or by the bot, which also fixes them with patch_skill), the built-in skills oppenheimer and /recap, and the built-in commands /goal /usage /loop /schedule.
sidebar_position: 5.5
---

A **skill** is a saved way of doing one task: when it applies, the steps, how to check, what to report. Ask the bot to "save that as a skill", or add one in **Settings → Skills**. Run it by typing `/` and its name in the chat; the bot can also use a skill on its own when a request fits, if you allow that on the skill.

## Skills the bot saves and fixes

A bot also keeps its skills up to date on its own. After a task that took real work and is likely to come again, it may save how it did it as a skill without being asked, at most one a turn, never for a one-off or anything private, and it says so by name. When a step of a skill it followed turns out wrong or out of date, it fixes that step with `patch_skill` once the task is done and tells you. It changes a skill you wrote only when you ask it to; otherwise it proposes the change in its answer. Each save or fix shows as a line in the chat, and the skill is in **Settings → Skills**, marked as the bot's.

## Built-in skills

Every bot also has one built-in skill, `oppenheimer`: before it answers a question about Oppenheimer itself, how to set something up in it, or what bots can do, it reads this guide with `read_oppenheimer_docs`, answers from the pages, and says so when the guide does not cover it. You do not run it; ask your question and the bot reads. No skill of yours can take that name.

A second built-in skill, `recap`, catches you up: type `/recap`, or `/recap` and a topic, or just ask "where are we?", and the bot reads your sessions, your pull requests, your plan and this chat, then answers with where things stand, what is waiting on you and the next move. It only reads. When a session the bot follows finishes, its report ends with a recap of that session, unasked. A Claude Code session does the same when you ask it to recall or catch you up, and ends each task it finishes with one; a Codex session does not yet.

## Built-in commands

Built-in commands work for every bot:

| Command | Does |
| --- | --- |
| `/goal <condition>` | Keep working across turns, with no limit, until the condition holds. When the bot says it is met, a reviewer on the bot's model checks what it showed. The goal pauses, and keeps its place, when a turn of it fails or is stopped (a provider's usage limit whose end is known is waited out, and the goal goes on by itself), after 3 turns that call no tool, when it spends its token budget (if the bot set one) or when the bot says it needs you; **Resume** above the composer or `/goal resume` runs it again. Stop or `/goal clear` ends it. |
| `/usage` | A card with this chat's turns, tokens, cache hits, and plan limits where reported. No prices. |
| `/loop [interval] [prompt]` | Run a prompt now and every 1 minute to 1 day, or when the bot chooses. One per bot; ends after 3 days, on `/loop stop`, or when the bot ends it. |
| `/schedule <request>` | Save a routine from your words (what and when). `/schedule` alone opens Routines. |

`/plan` and `/grill-me` are planned, not available.
