# 32 — The side pane: what opens beside a session

The owner asked on 2026-11-16 for "side chats and terminals and also bots
in the right side", after a screenshot of another product's right panel
(Review, Terminal, Browser, Files, Side chats, Source control). Asked what a
side chat is, they named three things, and a fourth: another session,
maybe on another host and about another topic; a bot; another agent in the
same worktree; and a terminal. So a side chat is not a kind of thing. It is
whatever you open in a second place beside the session you are in.

## 1. What it is

The session bar's panel toggle opens a pane at the session's right, as the
preview pane did (note 30). The pane holds **tabs**, one per thing opened
in it, and a **launcher** when none is shown: when the pane is empty, and
from the tab strip's plus.

| The launcher opens | As | Whose |
|---|---|---|
| **Terminal** | a plain shell in the session's worktree: tmux window 1 and up (window 0 is the agent's, note 02 §6), attached like the agent's, its own scrollback and size | the host's: closing the tab closes the shell |
| **Session** | another session in the workspace, on any host, searchable: its own pane without its bar, so its view switch and Share sit on its status line | this device's |
| **Bot** | a bot's chat, searchable by name and job: the same conversation as its page in Employees, without the page's head | this device's |
| **Browser, Simulator, Desktop** | the previews of note 30 and the host's desktop, each offered when the console and deployment can show it | this device's |

The tab strip is the chat's (`ChatTabStrip`); a tab's close is its own,
and the shown tab's neighbour shows when it closes, as a browser does. A
session or a bot tab adds a link to its own page beside the strip.

## 2. Who keeps what

- **Terminals are the host's.** A shell window lives in the session's tmux
  session, so the pane lists them from the host: one opened on the laptop
  shows on the phone, and `exit` in the shell says so in its tab. The
  control plane asks the runner for the list over the link
  (`session.windows.list`), and the runner answers opening and closing a
  window with the list after the change (`session.windows`), so the API
  stores nothing (`01-protocol.md`). A runner too old to answer is told
  apart and the launcher leaves Terminal out.
- **The rest is this device's**, like whether the pane is open: which
  sessions, bots and previews this reader keeps beside this session, and
  which tab showed last, in local storage under the session's id. The API
  never hears of it.
- Only the owner reaches a session's windows: a share still opens window 0
  and nothing else (`session-share.schema.ts`).

## 3. A second agent in the worktree

The owner's third kind, built on 2026-11-16. The launcher's **Agent** opens
a window like Terminal does and starts a coding agent in it instead of
leaving a shell. Asked the same day, the owner wanted the pick to be New
session's engine without the host, since the agent starts on the session's
own: the engine button (the agent, its model and its effort), the
permission level beside it, then Start. It opens on the session's own
engine when that agent may run twice, so Start alone starts a second copy
of it; otherwise on the first agent offered, at its defaults. The agents
are those this device offers (Settings → Agents, as New session's engine
picker reads them), the blank terminal left out since it is Terminal.
Before anything starts, the pane says what it means: the agent works in
this session's worktree, on the same files and the same git index as the
agent already there. Nothing stops two agents editing one file; that is
the reader's call, said once, not a lock.

- **On the wire.** `session.window.open` takes an optional `agent`, a
  catalog id other than `shell`, with its `model`, `effort` and
  `permission`, and a runner that can start one names
  `session.window.agent` in its hello. `POST /sessions/:id/windows` takes
  the same four; a runner without the capability is `SESSIONS_060`.
- **On the host.** The runner opens the window in the background, as for a
  shell, and launches the agent in it the way window 0's is launched, with
  the model, effort and permission it was given. A request without them
  (an older console) takes the session's permission level, and its model
  and effort only when it is the session's own agent, since a model
  belongs to one agent. It has
  no first task, no conversation id and no chat server: its own
  conversation is the CLI's. The window is named after the agent, so a
  listing says what runs there, and the tab reads "Codex 2".
- **Not a second copy of an agent found by its folder.** The runner finds
  the conversation of Codex, OpenCode, Pi and Oh My Pi by the session's
  directory (the newest transcript there; a restart resumes "the last"), so
  a second Codex in a Codex session would become the session's chat and be
  what a restart reopens. Only an agent whose CLI takes the conversation's
  id (Claude Code's `--session-id`, Grok's) may run twice: the picker leaves
  the session's own agent out otherwise, and the runner refuses it. A
  Claude Code session that continues a cloud one (teleport) is found by its
  folder too, so the runner refuses a second Claude there; the pane says
  so if it is asked. Any other agent beside it is fine.
- **What it is not, yet.** Window 0 is still the session's agent: its state
  dot, its chat view and its transcript are window 0's. A second agent is
  read in its terminal only.

## 4. Not yet

- A second agent's chat view and state dot.
- Review, Files and Source control from the screenshot are not asked for.
