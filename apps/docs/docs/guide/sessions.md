---
title: Sessions
description: Starting a session (project, where it runs, host, repositories, agent, model, permission level), the terminal and Chat views, the state dot, the Browser and Simulator preview, sharing a session, stopping, restarting and deleting it (what happens to the branch and worktree), cloud sessions, kept sessions and child sessions.
sidebar_position: 3
---

A **session** is a terminal on one of your hosts with a coding agent in it. The runner makes a folder for it, starts a tmux session there, launches the agent in window 0, and streams the terminal to your browser. Closing the tab does not stop it.

## Starting a session

Open **Sessions → New session**. The page is one box ("What should we work on?") with the project above it and a row of choices under it. Each choice opens on what you picked last time; picking a project fills in that project's defaults.

| Choice | Options |
| --- | --- |
| Project | Any project, or Unassigned. New project… at the foot. |
| Where it runs (one chip with the host, e.g. "mac-studio · New worktree") | **New worktree**: clone a repository onto a fresh branch. **Folder on host**: open a directory already on the host as it is; nothing is cloned. **Cloud**: Claude Code's or Codex's cloud started from a host, or Cursor's cloud (below). |
| Host | Your hosts with their online state. An offline host is allowed: the session waits as Queued. |
| Repositories | For a new worktree, one to five repositories, each on its own base branch. The agent starts in the first. "Manage repository access" opens the GitHub App's settings. |
| Agent and model | Claude Code, Codex, OpenCode, Grok, Pi, Oh My Pi, or **Blank terminal** (a login shell, nothing launched). Each agent lists its models; older ones are under More models. Star a model to keep it under Favourites. |
| Permission level | **Ask for approval** (the agent asks before it runs anything), **Approve for me** (edits and safe commands run, the rest asks; the default), **Full access** (nothing is asked; it can change the machine unattended). Hidden for a blank terminal. |
| Effort | How long the agent may think, where the model supports levels. |

Write the first task and press Send. You can attach files to the first task (images, PDFs, text files, up to 5 MB each). For a blank terminal the text only names the session.

The host starts preparing the clone as soon as a host and repository are picked; a repository's first session on a host takes longer. While it starts, the pane shows the steps (connect, clone, check out, start the agent) and which one failed, if any.

A worktree session works on a new branch, `oppenheimer/<slug>`, cut from the base you chose, with git access through one-hour tokens scoped to its repositories ([GitHub](./github.md)).

A **folder session** works in your own folder, on whatever branch it is on, with your own git credentials. Oppenheimer never writes into or deletes that folder.

## The sidebar

The Sessions sidebar lists sessions under their projects, with **Pinned** at the top, a search, filters (project, repository, agent, host) and a sort. The repository filter takes several repositories at once and lists a session that checks out any of them; each one shows as its own chip. A row's menu has **Rename**, **Hide**, **Move to project…**, **Pin**, **Share…** and **Delete**; Select acts on several rows at once.

### Hidden sessions

A hidden session keeps running but stays out of the sidebar. You hide one from its row's menu. A bot, a script or an agent can also start one hidden: `start_session` with `hidden` for a bot or over MCP, `opp sessions run --hidden` from the CLI. To see hidden sessions, turn on **Show hidden sessions** in the filter menu, which also counts them. They are listed with an eye-off icon, and **Show** in a row's menu brings that session back for good. Every device sees the same hidden sessions, and the toggle is kept per device.

## The state dot

Each session shows a state, read from the agent's own status report where it gives one (Claude Code) and otherwise from its screen:

| State | Means |
| --- | --- |
| Starting, Queued | The host is creating it, or it waits for an offline host. |
| Running | The agent is working. |
| Needs input | The agent waits on you: a permission, a question, a sign-in. A note says which. |
| Ready for review, Idle | The agent finished and waits at its prompt. |
| Failed | The host could not start it. |
| Stopped | Nothing runs; the worktree is kept. |

Sessions that need input, failed, or have not started after a minute also appear in the [Inbox](./inbox.md).

## Terminal and Chat

The session pane has a bar with the name, the state, **Terminal / Chat**, the preview toggle and **Share**.

- **Terminal** (the default) is the agent's real terminal. Type into it as you would locally. A plain drag selects and copies text. Paste or drop files onto it and their paths land in the agent's prompt.
- **Chat** shows the same conversation read from the agent's transcript on the host: your messages, the agent's replies, its tool calls grouped ("read 3 files, ran 2 commands"), images it read, and files it shared. You can write to the agent and attach files from the chat's composer. Chat works for Claude Code, Codex, OpenCode and Grok; Pi and Oh My Pi are terminal only for now, and a blank terminal has none.

The console shows window 0, the agent's window. Extra shell windows can be made from the host with `runner sessions window`, but the console has no tab strip for them yet.

## Preview: Browser and Simulator

The preview toggle opens a pane beside the terminal:

- **Browser** shows a dev server the session runs, through the host's runner: pick any port the session listens on from 1024 up; the tab opens on the likeliest one (5173, 3000…). The app sees `localhost`. It shows "Waiting for a dev server" until one starts, and needs the deployment to have a preview domain configured.
- **Simulator** shows an iOS simulator or Android emulator the host offers to its sessions, which you can watch and tap. It appears only on hosts set up with devices.

## Sharing a session

**Share** (in the session bar or the row's menu) gives one address per session, `/s/…`.

- **Who**: specific people by email, or anyone with the link; either way they must sign in to Oppenheimer.
- **Can view**: watch live, for 1 hour up to 7 days, or until you stop.
- **Can write**: type and send prompts as you, with your credentials. Named people only, at most 24 hours, after you confirm "I understand they act as me on this host".
- Guests see the terminal and the chat. **Stop sharing** ends access at once.

## Stopping, restarting, deleting

- **Stopped**: the agent and terminal end, the checkout stays. **Restart** brings the agent back in the same folder, resuming its conversation.
- **Delete** stops the session, pushes each checkout's branch if it has commits, removes the worktree and session folder from the host, and drops the transcript. Commits already pushed stay on the remote. If there is work that is not pushed, delete stops unless you tick **Also discard work that is not pushed**. Oppenheimer never commits for you.
- Deleting a folder session only ends its terminal; the folder stays. If the host is offline, the session is removed when the host is back.

A host reboot leaves sessions stopped, waiting for Restart. A session marked **kept** comes back on its own after a reboot; keeping is set from inside the session with `runner sessions keep` (there is no console switch).

## Cloud sessions

Under **Cloud** in the where-it-runs chip:

- **Claude Code**: a host starts it with `claude --cloud`, under the Claude account that host is signed in to; it runs on claude.ai/code. Its state comes from the Oppenheimer Chrome extension while you are signed in to claude.ai. **Continue on a host** brings it back as a worktree session.
- **Codex**: a host starts a Codex cloud task and reports its status while online. In the Codex environment chip, **Default** runs it in Codex's default environment with the repository; to use another, paste its id from ChatGPT Settings → Codex Cloud. The host's `codex` must be signed in with ChatGPT (`codex login`).
- **Cursor**: runs in Cursor's cloud on your own key, no host. Connect the key in **Settings → Cloud agents**.

A cloud session needs a task and has no terminal here. Follow-ups go to the vendor, except Cursor's, which take one through Oppenheimer after the last run ends. Deleting one removes it from Oppenheimer only.

**The chat of a Claude Code cloud session.** A Claude Code cloud session that Oppenheimer started can show its chat in the session's pane, and take your replies, once its repository carries Oppenheimer's two hooks: one sends the session's conversation to Oppenheimer, the other collects what you type. Setting the hooks up is not in the console yet. Until the first line arrives, the pane is the usual cloud pane with its claude.ai link. A reply is handed to the agent when its current turn ends. If the session is idle, so nothing takes the reply within 15 seconds, one of your online hosts signed in to the same Claude account as the host that started the session sends it with `claude -p … --cloud`, and the session wakes up and answers. The chat shows that reply as sent until the agent picks it up. With no such host online, the reply waits for the session's next turn. Stop does nothing on a cloud session, and a session started on claude.ai rather than from Oppenheimer shows no chat here.

## Child sessions and in-session tools

An agent inside a session has a `runner` command (its manual is `runner --skill`). With it the agent can start helper agents on the same host as **child sessions** (`runner sessions run`), message and wait on them, show you a file in the session's chat (`send-file`), send you a line in the Inbox (`notify`), be woken when its pull request's checks finish or it is reviewed (`watch-pr`), and set a wake-up up to 7 days ahead (`wake-in`). Child sessions run on the host, end when their parent ends unless started with `--outlive-parent`, and are not shown in the console's sidebar; the parent agent manages and closes them. To start work on another host, an agent uses `opp` ([CLI and MCP](./cli-and-mcp.md)).
