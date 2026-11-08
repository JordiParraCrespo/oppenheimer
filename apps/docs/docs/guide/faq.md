---
title: FAQ
description: Short answers to common questions, such as whether a bot can run commands, where files and code live, what happens when a host goes offline or reboots, what is stored about you, which agents and providers are supported, and what is not available yet.
sidebar_position: 11
---

## Can a bot run commands or read files?

No. A bot runs inside Oppenheimer with no shell, no files and no access to the server. When work needs a shell or a checkout, it starts a session on one of your hosts, where a coding agent does it, and reports what the session shows. See [Bots](./bots.md).

## Can a bot do anything I cannot?

No. Every tool call runs as you and is checked against your current permissions. A bot never gets access to pairing hosts, connecting GitHub or Gmail, sharing sessions, API tokens or deleting bots.

## Where do my code and files live?

On your hosts. A worktree session's checkout is under the host's work folder (`~/oppenheimer/` by default); a folder session works in your own folder. The agent's conversation (its transcript) also stays on the host; the console reads it from there when you open the Chat view. Oppenheimer itself keeps a session's log (tasks, prompts, states), not your checkout. Bot chats, bot memory and images sent to bots are stored in Oppenheimer.

## Is anything on my machine exposed to the internet?

No. The runner opens no port; it holds one outbound connection to Oppenheimer.

## What happens when a host goes offline?

Running sessions keep running in tmux on the host; the terminal says "Host offline" and reconnects by itself. New sessions on that host wait as Queued and start when it is back. Removing a host from Settings → Hosts stops its sessions. See [Hosts](./hosts.md).

## What happens when a host reboots?

Sessions come back stopped, with their worktrees intact. Press **Restart** to reopen the agent where it left off. A session marked kept (`runner sessions keep`) restarts on its own.

## Does a runner update interrupt my agents?

No. Sessions live in tmux, apart from the runner. The runner waits for a quiet moment to update, and terminals reconnect in a few seconds.

## Which agents can a session run?

Claude Code, Codex, OpenCode and Grok, or a blank terminal. Each uses the host's own installation and sign-in; you sign in once per host in the terminal. Claude Code, Codex and Cursor can also run in their vendors' clouds.

## Which models can bots use?

Claude through Anthropic, GPT through OpenAI or a ChatGPT subscription, Grok through xAI, and GLM through z.ai. Add keys in Settings → Model providers.

## Does Oppenheimer store my GitHub token or my agents' logins?

Sessions get one-hour tokens scoped to their repositories, handed to git on the host and never written to disk. Your own GitHub user token is kept only when the deployment has a key for it: connecting GitHub then stores it encrypted, so the Pull requests section can act as you, and drops it when it can no longer be refreshed. Agent logins stay in each agent's own config on the host. Model provider keys you add for bots are stored encrypted and never shown again.

## What happens to a session's branch when I delete it?

Its branch (`oppenheimer/…`) is pushed when it has commits, then the worktree is removed. If there is work that is not pushed, deleting stops unless you choose to discard it. Oppenheimer never commits for you.

## Can someone else see my session?

Only if you share it: specific people or anyone signed in with the link can watch; named people can be given write access for up to 24 hours, acting as you. See [Sessions](./sessions.md).

## Can I have a team workspace?

Not yet. Each workspace has one person, with no members or invitations.

## How do I start work from a script or another agent?

Use `opp` or the MCP server with a scoped API token. See [CLI and MCP](./cli-and-mcp.md).

## Where do I find things that need me?

**Plan → Inbox**, where the console opens by default. See [Inbox](./inbox.md).

## What is not available yet?

Virtual machines and containers as hosts; teams; Slack; people writing to a bot over mail, WhatsApp or Slack; bot templates and group chats; the `/plan` and `/grill-me` commands; automation templates and headless runs; push guardrails; extra terminal windows in the console; pull requests from forks in review sessions.
