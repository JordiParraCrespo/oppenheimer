---
title: Hosts
description: Connecting a machine you own as a host (supported systems, pairing, the install, the user service, automatic updates), the Settings → Hosts page, agent CLIs on a host, what offline means, and removing or uninstalling a host.
sidebar_position: 2
---

A **host** is a machine you own that runs Oppenheimer's host agent, the `runner`. Every session that is not a cloud session runs on a host, as your user, with the host's own tools and logins. A host belongs to you, not to a workspace.

The runner holds one outbound connection to Oppenheimer. It opens no port, and nothing on the host is reachable from the internet. The console reaches the terminal through that connection, or, when the network allows it, through a direct encrypted browser-to-host channel that falls back to the relay.

## What a host needs

| Requirement | Detail |
| --- | --- |
| System | macOS, Debian or Ubuntu, on arm64 or amd64. Nothing else is supported. |
| User | An ordinary user account. The installer refuses to run as root. |
| Tools | `git` and `tmux`. The installer offers to install them with Homebrew or apt, but only on a typed yes; without them it stops before using the token. |
| A lasting machine | The runner refuses machines that look temporary (Docker or Podman containers, CI, Codespaces, dev containers, Kubernetes pods). |
| Agent CLIs | Optional at install: Claude Code, Codex, OpenCode, Grok and GitHub's `gh`. The default is Claude Code and `gh`. |

Sessions are capped at 20 per host by default.

## Adding a host

Open **Add host** from **Settings → Hosts**, from the host picker in New session (Add host…), or during first-run. Each opens a **one-hour, single-use registration token**. You can hold at most five unspent tokens; **New token** replaces the one on screen and the old one stops working at once.

There are two ways to use it:

- **Copy prompt** (the default): paste the prompt into a coding agent (Claude Code, Codex) already running on the machine you want. The agent first checks it is on the right machine and asks you where session code should live and which agent CLIs to install, then runs the install and reads back `runner status`.
- **Install manually instead**: run the one-line `curl … install.sh | … sh` command in a terminal on the machine yourself. The token rides in the environment, not as an argument. The installer's SHA-256 is shown under the command if you want to download and check it first. Settings' Add a host page offers both as an Install format choice, Command or Agent prompt.

The **Connection** list then moves from "Runner installed" to "Host connected", and the host appears in Settings → Hosts. Every pairing also emails you the machine's name and the start of its key fingerprint, so you notice a pairing you did not make.

What the installer does, in order: checks the system, asks its questions up front, downloads the release and verifies its checksum (and its signature where OpenSSL 3 is present), places the binary under `~/.oppenheimer/bin` with an `oppenheimer-runner` command in `~/.local/bin`, registers the host, installs the user service, installs the chosen agent CLIs, and prints `runner status`. Re-running the same command repairs a half-finished install instead of adding a second host.

## The service

- **macOS**: a launchd user agent that starts at login and is kept alive.
- **Linux**: a systemd user unit with lingering enabled, so it survives logout and starts at boot.

Sessions live in a dedicated tmux server, not in the runner process, so restarting or updating the runner does not interrupt an agent.

## Where things live on a host

| Place | Holds |
| --- | --- |
| `~/.oppenheimer/` | The runner's identity, key, binaries, logs and state. Never where an agent works. |
| `~/oppenheimer/` (the work folder, chosen at install) | Repository stores and session checkouts, under your account and workspace. |

`oppenheimer-runner workspaces --set DIR` moves the work folder for new sessions; it refuses while a session's checkout is still in the old one. Uninstalling never touches the work folder.

## Settings → Hosts

Each host is a card with:

- its name (Rename in its menu; the name is display only);
- platform, CPU count, runner version, and the Claude account its Claude Code is signed in to, when it reports one;
- the city and country of its connecting address;
- a status: **Running · N sessions**, **Idle** or **Offline**, with "connected" or "last seen …".

The card's menu also has **Update runner**, **Open terminal** (a blank terminal in your home directory on that host, as a session) and **Remove host**.

An online host's card also has **Desktop**, which opens the host's own screen (below).

## A host's desktop

You can watch and drive a host's own screen from the console: from **Settings → Hosts → Desktop** on the host's card, or from a session's preview pane (the panel button in the session's bar), in its **Desktop** tab, which shows the screen of the session's host.

The host's owner decides whether its screen is shared, on the host itself:

- `runner desktop on` shares it; `runner desktop off` stops; `runner desktop` says how it stands. Nothing in the console turns it on.
- The runner does not start a screen: it uses the screen-sharing server the machine already runs on its loopback, `127.0.0.1:5900` unless `--port` names another. On a Mac that is **Screen Sharing** (System Settings → General → Sharing); on Linux a VNC server such as TigerVNC or x11vnc listening on `127.0.0.1`.
- If the server asks for a password, give the runner a file holding it, readable by that account only: `runner desktop on --password-file <file>`. macOS Screen Sharing signs in a macOS account: add `--username <account>`. The password stays on the host; the browser is never asked for one.

The desktop opens **watching**: you see the screen, and your clicks and keys reach nothing. **Take control** lets them through, until **Stop controlling**; the host itself drops your input while you only watch. Your session on the screen is shared, so watching never disconnects anyone else using it. **Full screen** gives the desktop the whole window; Escape leaves it.

When the desktop cannot open, it says why: the host does not share its desktop (with the command to run there), no screen-sharing server answers on the host, or the server refused the host's sign-in. Fix it on the host, then **Try again**. An offline host's desktop comes back when the host reconnects.


## Agents on a host

Each agent runs from the host's own installation and its own login. You sign in once per host by starting a session with that agent and following its sign-in in the terminal; a sign-in link the agent prints becomes a button. Oppenheimer never stores an agent's credentials.

From the host you can install more later: `oppenheimer-runner agents install claude` (or `codex`, `opencode`, `grok`), and `oppenheimer-runner tools install gh`. These install in your home directory without sudo. `git` and `tmux` stay with your package manager. The runner updates installed agent CLIs on its own about hourly unless `RUNNER_AGENT_UPDATES=off` is set before install. `oppenheimer-runner tools` lists what is installed.

## Updates

The runner keeps itself on the current signed release. It checks at boot and every six hours, then waits for a quiet moment (no agent working, no terminal attached) for up to 24 hours before updating; urgent updates apply within 15 minutes. A new version that will not stay up is rolled back automatically. Sessions keep running through an update; open terminals reconnect in a few seconds.

To update now, use **Update runner** in the host's menu (only while the host is online), or `oppenheimer-runner update` on the host. `oppenheimer-runner update --pin VERSION` freezes a host on a version; a pinned host refuses Update runner until `--unpin`. A bot can ask for the same update with its `update_host_runner` tool, after your approval.

## What offline means

A host is **Offline** when its runner is not connected: the machine is off or asleep, the network is down, or the runner stopped.

- Sessions already running keep running in tmux on the host if only the connection is lost. The terminal shows "Host offline" and reconnects on its own, catching up on output.
- A session you start on an offline host waits as **Queued** and starts when the runner reconnects.
- After a **reboot**, sessions come back stopped, with a **Restart** button that reopens the agent in the same worktree. A session marked kept (`runner sessions keep`, run from inside it) restarts on its own.
- Automations defer runs aimed at an offline host; bots check that a host is online before starting work.

When a terminal says the host is offline, **How to fix** gives the commands to run on the host (`oppenheimer-runner status`, the log, a reinstall) and a troubleshooting prompt you can hand to an agent there.

## Removing a host

**Remove host** in Settings → Hosts stops every session running on it (their logs are kept), revokes the runner's credential, and pauses automations aimed at it. Tick **Also delete everything on this machine** to also close every session and delete its worktree, uncommitted work included, with nothing pushed; that needs the host online.

On the host, `oppenheimer-runner uninstall` stops the service, unpairs the host and erases its identity. It refuses while sessions run unless `--force`. If Oppenheimer could not be told, it exits with code 7 and you finish it with Remove in Settings → Hosts. Binaries, logs and the work folder are left for you to delete.

To pair the same machine again, use Add host. If a host key may have been stolen, remove the host and pair it again.
