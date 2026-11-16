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

## 3. Not yet

- **A second agent in the same worktree** (the owner's third kind). It is
  a window with an agent started in it rather than a shell, on the terminal
  tab's plumbing, and its own proposal: two agents edit the same files and
  the same git index, so the launcher will say "shares this worktree", and
  its chat view and state dot come after its terminal.
- Review, Files and Source control from the screenshot are not asked for.
