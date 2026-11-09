---
title: Bots (Employees)
description: What a bot is and how to create one, its settings (Profile, Instructions with SOUL.md and INSTRUCTIONS.md, Memory, Skills, Permissions, Routines, Home host), model providers and keys, how a bot does code work through sessions, its tools, slash commands, the built-in skills oppenheimer and /recap, the built-ins /goal /usage /loop /schedule, approvals, and its limits.
sidebar_position: 5
---

A **bot** is an LLM worker you chat with. The console calls the section **Employees**; inside it each one is a bot. A bot's loop runs inside Oppenheimer on the model provider you choose, not on a host. It has **no shell, no files and no access to the machine it runs on**. It acts through Oppenheimer's own tools, as you, and never with more access than you have. For work that needs a shell or a checkout, it starts a session on one of your hosts.

## Creating a bot

In **Employees**, press **New bot**. A new bot gets a first name (Juno, Milo, Wren…), a colour and a drawn face: a round face in its colour wearing a hat, with eyes and a mouth taken from the bot itself, so it keeps its face through a rename. Its first chat walks it through one job: tell it what it is for in a message, and it writes its own `INSTRUCTIONS.md` and description, remembers what it learned about you, and offers a first task. One bot per job works best.

The Employees sidebar holds your bots in groups (New group, Move to group) in an order you drag. A bot can also be shown in the Sessions, Automations, Plan and Pull requests sidebars: use the plus on a section's Bots heading, or **Shows in** on the bot's Profile. Its chat opens in place there; it is the same bot and the same conversation everywhere.

## The chat

- Each message starts a **turn**; one runs at a time per bot, and closing the tab does not stop it. **Stop** cancels it. While it runs, **Enter steers** it and **Alt+Enter queues** your message for after.
- The chat shows the bot's text, an activity line per run of tool calls, cards for what needs you, and a line for every change it makes to itself.
- You can send images (PNG, JPEG, GIF, WebP; up to 5 MB, four a message), except to GLM models. No other file types.
- The composer picks the provider, model and effort, and its meter shows context use and, on a ChatGPT sign-in, the plan's limits.

## Settings

Open a bot's settings from its menu. Every page saves with **Save**.

| Tab | What it holds |
| --- | --- |
| Profile | Name, description, colour, face (pick a hat, eyes and a mouth, or **Use its own face**), sidebar group, Shows in, and the chat history (Export, Clear history). |
| Instructions | Two files read before every message: **SOUL.md** (personality and tone) and **INSTRUCTIONS.md** (its job and rules). Each save is a revision; Revision history can Revert. |
| Memory | Facts it remembers, with who added each. **Learn automatically** lets it save facts without asking. A bot has two memories: its own, which only it reads and where everything about its job goes (your projects, repositories, folders, hosts, accounts, how you want that work done), and the **general memory** about you, which all your bots read and which only takes what a bot with another job would need too (your name, language, time zone, how you like to work everywhere). A fact can also be kept in mind in every chat or looked up only when needed. Up to 500 facts. What every bot knows about you is also one page of its own, **Settings → Memory** at the account: an **About you** text you write (up to 4,000 characters), in every bot's prompt and never changed by a bot, and every fact about you your bots learned, each naming the bot that keeps it. About once a day, after it has saved enough and while Learn automatically is on, the bot **tidies its memory**: its own model merges repeats, drops what is stale or contradicted and rewrites each fact it wrote as one clear sentence, leaving the facts you wrote word for word. The chat shows a line ("Tidied its memory · 40 facts → 22"); **Tidy now** runs one whenever you like, and **Undo** puts the latest tidy back. |
| Skills | Saved recipes for a task, at most 50. |
| Permissions | Each tool set to Allow, Ask or Off; standing grants; plain-language rules. |
| Routines | Its scheduled and event routines ([Routines and watches](./routines-and-watches.md)). |
| Home host | Where its sessions start when nobody names a machine, or **No home host** (it asks each time). The bot itself always runs in Oppenheimer. |

## Model providers

Keys live in **Settings → Model providers**, one per provider for the workspace, stored encrypted and never shown again.

| Provider | Models | How |
| --- | --- | --- |
| Anthropic | Claude | API key |
| ChatGPT | GPT | **Connect ChatGPT**: sign in with a one-time code; runs on your ChatGPT subscription, not API billing |
| OpenAI | GPT | API key |
| xAI | Grok | API key |
| GLM | GLM, through z.ai | API key |

**Make default** picks the provider new bots start on. Without one, a bot uses the first provider that has a key, in the order Anthropic, ChatGPT, OpenAI, Grok, GLM. A bot whose provider has no key cannot answer until one is added.

## How a bot works on code

A bot answers what its own tools, web search and web fetch can answer. When the work needs a shell or a checkout (tests, a build, a fix) it starts a session: a coding agent on a host, always at Approve for me, in a known project's repository or a folder it was given, on the host you named, else the project's default, else its home host. It follows that session, is woken when the agent needs input, finishes, fails or looks stuck, and reports what the session shows.

It can also prompt a session whose agent waits at its prompt, answer an agent's question or permission dialog, stop a session, close a session it started itself (most often one that failed, so it does not stay in your sidebar; it asks first under Approve for me, keeps work never pushed unless you said it can go, and cannot close a session you, an automation or a review started), read a session's log and conversation, and start cloud sessions.

## What else it can do

- **Itself**: edit SOUL.md, INSTRUCTIONS.md, name and description; remember, forget, recall; search its chat.
- **Hosts**: list your hosts with their runner version, and update a host's runner (`update_host_runner`, the same as **Update runner** in the host's menu; it asks first under Approve for me, and only reaches an online host). When a session's conversation, a shared file or a terminal watch needs a newer runner, the bot can offer to update it.
- **Plan**: read projects and tasks; create, edit and move tasks; create and edit projects; move sessions; archive or restore a project.
- **GitHub**: read repositories, pull requests and issues; comment, review, merge, start review sessions, open issues, record CI findings, all in your name.
- **Automations**: list them and their runs. It cannot create or change yours; it manages only its own routines.
- **Other bots**: message one, ask one a task (the answer comes back as a new turn), create one. Chains stop at 3 bots deep and 10 bot-to-bot turns.
- **Mail, WhatsApp and Telegram**: with Gmail connected in **Settings → Mail**, search, read, draft, send, schedule, label, archive and trash mail. With a number linked in **Settings → WhatsApp** (held by a host; use a spare number), read chats and send messages. With a bot of yours from @BotFather connected in **Settings → Telegram** (its token stays on the host), read the chats people have with it and answer them; Telegram lets a bot write only to chats that wrote to it first.
- **Work**: web search, fetch public pages, show images from the web, run up to four read-only subagents, ask you up to four questions on a card, `notify` your Inbox, and read this guide (`read_oppenheimer_docs`).

## Skills and slash commands

A **skill** is a saved way of doing one task: when it applies, the steps, how to check, what to report. Ask the bot to "save that as a skill", or add one in **Settings → Skills**. Run it by typing `/` and its name in the chat; the bot can also use a skill on its own when a request fits, if you allow that on the skill.

Every bot also has one built-in skill, `oppenheimer`: before it answers a question about Oppenheimer itself, how to set something up in it, or what bots can do, it reads this guide with `read_oppenheimer_docs`, answers from the pages, and says so when the guide does not cover it. You do not run it; ask your question and the bot reads. No skill of yours can take that name.

A second built-in skill, `recap`, catches you up: type `/recap`, or `/recap` and a topic, or just ask "where are we?", and the bot reads your sessions, your pull requests, your plan and this chat, then answers with where things stand, what is waiting on you and the next move. It only reads. A Claude Code session does the same when you ask it to recall or catch you up; a Codex session does not yet.

Built-in commands work for every bot:

| Command | Does |
| --- | --- |
| `/goal <condition>` | Keep working across turns until the condition holds. After each turn a reviewer on the bot's model judges met, not met or impossible. Up to 20 continuations; Stop above the composer or `/goal clear` ends it. |
| `/usage` | A card with this chat's turns, tokens, cache hits, and plan limits where reported. No prices. |
| `/loop [interval] [prompt]` | Run a prompt now and every 1 minute to 1 day, or when the bot chooses. One per bot; ends after 3 days, on `/loop stop`, or when the bot ends it. |
| `/schedule <request>` | Save a routine from your words (what and when). `/schedule` alone opens Routines. |

`/plan` and `/grill-me` are planned, not available.

## Permissions and approvals

The composer's **approval level** is a preset: **Approve for me** (what stays inside Oppenheimer runs; what reaches outside asks: starting or prompting sessions, GitHub writes, creating bots, sends) or **Full access** (everything runs without asking, except the few calls below that always ask). **Settings → Permissions** overrides any tool with **Allow**, **Ask** or **Off** (Off hides it from the bot).

When a tool asks, the turn ends on a **Needs input** card in the chat and in the Inbox. The card offers what fits the call: **Approve once**, **Always allow for** the repository, project, session or chat it acts on, **Always allow**, **Deny** (the bot is told and carries on), or **Deny and stop**. Writing to the bot instead dismisses the card. Some calls always ask, under Full access too: sending, scheduling or trashing mail, and archiving a project. Merging a pull request is approved one call at a time (no **Always allow**, and setting it to Allow does not stop it asking under Approve for me), but under **Full access** a bot merges without asking unless you set merging to **Ask** in **Settings → Permissions**. Rules ("Ask me first when…", "Go ahead without asking when…") are checked before an asking call; an ask rule wins.

## Limits

- A turn stops after 4 minutes and 20 model round trips; longer work is a goal, a loop or a session. Older history is summarised for the model; the chat keeps every message.
- A bot cannot pair or remove hosts, connect GitHub, Google or Gmail, share sessions, manage API tokens, or delete bots.
- Not available: calendar tools, files other than images, group chats, bot templates, and writing to a bot from Slack, mail, WhatsApp or Telegram.
