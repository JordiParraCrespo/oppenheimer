---
title: Overview
description: Start here. What Oppenheimer is, its parts (workspace, hosts, sessions, projects, tasks, bots, automations, inbox) and how they fit, and a map of the console's sections and Settings pages.
sidebar_position: 1
---

Oppenheimer is a browser console for running coding agents on machines you own. You connect a machine (a **host**), and Oppenheimer starts **sessions** on it: each session is a terminal on that host, usually in a fresh git worktree, with a coding agent (Claude Code, Codex, OpenCode, Grok, Pi or Oh My Pi) or a plain shell running in it. The terminal is streamed to your browser, so you can watch and type from a laptop or a phone, and the agent keeps working when you close the tab.

Around sessions sit the things that organise and automate the work: **projects** and **tasks** to plan it, **automations** that start sessions on a schedule or a GitHub event, **bots** (shown in the console as **Employees**) that you chat with and that can start and follow sessions for you, and an **Inbox** that collects everything waiting on you.

## The parts

| Part | What it is | Read |
| --- | --- | --- |
| Workspace | Your personal space: hosts, projects, sessions, bots and history. One person per workspace; there are no teams, members or invitations. | this page |
| Host | A macOS, Debian or Ubuntu machine you own, running the `runner` agent. Nothing on it is exposed to the internet: the runner dials out to Oppenheimer. | [Hosts](./hosts.md) |
| Session | A terminal on a host, in a new git worktree, in a folder already on the host, or in a vendor's cloud. Window 0 runs the agent. | [Sessions](./sessions.md) |
| Project | A saved scope: a name, repositories with their branches, a default host and agent. Sessions, tasks and automations are filed under one. | [Projects and tasks](./projects-and-tasks.md) |
| Task | A card on Plan's board. A task can start a session or link existing ones. | [Projects and tasks](./projects-and-tasks.md) |
| Bot | An LLM worker you chat with. It runs inside Oppenheimer (not on a host), has no shell, and does code work by starting sessions on your hosts. | [Bots](./bots.md) |
| Routine and watch | How a bot works without being written to: on a schedule, on an event, or when a session or pull request it follows changes. | [Routines and watches](./routines-and-watches.md) |
| Automation | A saved prompt with a project, host, agent and triggers. Each run is an ordinary session. | [Automations](./automations.md) |
| Inbox | One list of what needs you: waiting sessions, bot approvals, pull requests, failed runs, notices. | [Inbox](./inbox.md) |
| GitHub | The Oppenheimer GitHub App gives sessions access to your repositories; the Pull requests section is a review queue. | [GitHub](./github.md) |
| CLI and MCP | `opp` and an MCP server drive the same things from scripts and other agents. | [CLI and MCP](./cli-and-mcp.md) |

How they fit: a session always runs somewhere you own (a host) or at a vendor you hold a key for. A person, a task, an automation, a bot or `opp` can start it, and it is the same kind of session in every case. Bots and automations never get more access than you have: they act as you.

## The console

The console is a rail of sections on the left, a sidebar for the section you are in, and the main pane.

| Rail item | What it holds |
| --- | --- |
| **Employees** | Your bots: a sidebar of bots in groups, a chat with each, and each bot's settings. |
| **Sessions** | New session, and the sidebar of your sessions grouped by project, with Pinned at the top. |
| **Pull requests** | The PR queue, Analytics, and review sessions under For review. |
| **Automations** | The automations list by project, their runs and run history. |
| **Plan** | Inbox, Tasks (the board), Milestones, Calendar and Projects. |

You can drag the rail items into another order; the order is kept on that device. The console opens on **Plan → Inbox** unless you dragged another item to the top, in which case it opens on that one. Sessions, Automations, Plan and Pull requests can also list bots you place there, under a Bots heading in their sidebar; clicking one opens its chat without leaving the section.

**Settings** opens from the account menu and has these pages:

| Page | Use it to |
| --- | --- |
| Profile | Change your name, picture, username, email, password, signed-in devices, or delete the account. |
| Memory | Write **About you**, which every bot reads, and see, edit or forget what your bots learned about you. |
| Hosts | See, rename, update and remove hosts; Add host; open a blank terminal on a host. |
| Watched repositories | Pick repositories whose open pull requests fill the Watching tab of the PR queue. |
| Model providers | Add the API keys (or a ChatGPT sign-in) your bots run on. |
| Cloud agents | Connect a Cursor API key to run sessions in Cursor's cloud. |
| Mail | Connect Gmail accounts your bots may read and, with your approval, send from. |
| WhatsApp | Link a spare WhatsApp number on a host so bots can read and send messages. |
| Telegram | Connect a Telegram bot you made with @BotFather on a host so your bots can read and answer its chats. |
| About | The versions of the console and the API. |

A command palette ("Search pages and actions…") jumps to pages and actions. Prose fields (the new-session box, a bot's composer, review comments) have a microphone button for dictation when the deployment has a speech provider set up.

## Getting started

Signing up (GitHub, Google, or email and password) opens a short first-run flow:

1. **Name your workspace** and pick its address. The name can change later; the address is permanent.
2. **Connect GitHub**: install the Oppenheimer GitHub App on your account or an organization, with all or selected repositories. You can skip this and do it later from a repository picker.
3. **Add your first host**: copy a prompt for a coding agent already on that machine, or run the install command yourself. You can skip this too.
4. **You're all set**: a summary of the workspace, GitHub and host, then Go to the console.

After that, a typical first hour is: open **Sessions → New session**, pick the host, a repository and an agent, describe the task and send. Sign the agent in once in its terminal if the host has never used it. Then try a bot in **Employees**: create one, tell it its job in one message, and it writes its own instructions.

## What Oppenheimer does not do yet

- No virtual machines or containers: sessions run directly on your hosts, as your user.
- No teams: one person per workspace, and no way to invite others except sharing a single session's terminal.
- Bots cannot run commands or read files themselves; they delegate to sessions.
- No Slack integration, and no channel through which other people write to a bot.
