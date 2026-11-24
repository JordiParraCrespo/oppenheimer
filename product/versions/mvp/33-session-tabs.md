# 33 — Session tabs, the one-line bar, and the side pane's launcher

The owner asked on 2026-11-24 to reorganise a session's page after another
product's: open threads as tabs in the window's title bar, and a right panel
that opens on a list of large rows (Review, Terminal, Browser, Files, Side
chats, Source control). The look is rebuilt from screenshots in our own
code (`.agents/answers.md`, 2026-11-16). Each decision below was asked and
answered one at a time that day, mostly over mockups.

## 1. Open sessions are tabs

- **A tab per open session, and per open bot.** "You can open several
  sessions. When a session needs attention it is like tabs." A bot's chat
  inside Sessions (`/sessions/bots/$botId`, note 28) is a tab too.
- **Only on Sessions.** The strip is the bar of a session's page and of a
  bot's chat inside Sessions; Plan, Automations, Pull requests and Settings
  keep their bars. New session has no strip: it is where the plus and
  closing the last tab lead.
- **Opening is arriving.** Clicking a session or a bot in the sidebar, a
  link, the inbox or the address opens its tab, or shows it when it is
  open already. A tab never moves once opened; a new one goes last.
- **Closing** a tab not on screen leaves the page as it is. Closing the one
  on screen shows its neighbour, the one after it, else the one before, as
  a browser does; after the last, New session.
- **The device's.** Which tabs are open is kept in this browser
  (`oppenheimer.sessions.tabs`), the way pins and unread marks are; every
  browser tab on the device agrees through the storage event, and another
  device opens its own. The API never hears of them.
- **A gone session or bot leaves the strip** once its list has answered
  without it; the page on screen keeps its tab, since a session just
  created is on screen before it is listed. The strip scrolls when full,
  with no limit. A shared session's guest has no strip.

On 2026-11-24, once it shipped, the owner asked for New session to keep the
tabs: "on the create new I do not want to disappear the previous tabs". New
session's bar is the strip, the tabs open as they were, ending in a lit New
session tab of its own that is not kept (leaving the page leaves no tab);
the plus steps aside while it shows, and the image's button sits on the
bar's right. The same day, after trying a shorter grey band, the owner set
the bar at 45px (`--tab-bar-h`) with every control in it on the medium
rung, tabs included, and on the same ground as the page under it, the way
a calm app header reads: the terminal's colour on a session, the pane's
on New session, with a hairline at its foot. On New session the reader's
background image lies only under the content below the bar; the bar
keeps its dark ground over it. With no other tab open, New session keeps
the quiet bar it had before the tabs: the sidebar toggle and the image's
button on frosted chips, over an image that runs to the top. The shown
tab stands out by its card and hairline (§2), not by the band around it.

## 2. What a tab shows

The shown tab stands on the canvas inside a hairline; the rest are flat,
a hairline between two of them, their close appearing on hover. A long name
fades out rather than ending in an ellipsis. The mark is the agent's
(`AgentMark`) or the bot's face. What it needs from the reader is the dot
its sidebar row draws, on the mark: amber while it waits on you, blue once
it is ready for review or marked unread; its name shimmers while the agent
works.

## 3. One line

The bar is one line: the sidebar toggle, "Back to task" when there is one,
the tabs, and on the right Terminal and Chat as two quiet square icons (the
view on screen lit), a hairline, the side pane's toggle and Share as an
icon, lit while the session is shared. The session's branch or folder, its
state word and what its agent said it waits on move to its tab's tooltip.
Asked whether a second line should keep them in view, the owner chose one.

## 4. The side pane's launcher

The empty side pane (note 32) opens on large rows, centred: **Terminal**,
**Browser** (when offered), **Side chats**, then **Simulator** and
**Desktop** when this console and deployment show them. Side chats slides
to a second list: another agent in this worktree, another session on any
host, a bot. Each of those slides to its pick as before. The owner chose to
fold the three under Side chats so the list stays short.

## 5. What came next, and what waits

- **Review** (decided, the next two pull requests): a launcher row with the
  branch's changes ("5 files · +186 −14"), opening the changed files as
  cards with their diffs. It opens on everything since the branch left its
  base, commits and uncommitted edits, with Uncommitted, Last turn and a
  turn picked from the chat beside it. A note on a diff line collects with
  the others, and Send to agent sends them as one chat message, each with
  its file and line. It refreshes when a turn ends and from its button,
  never on a timer, and only the owner sees it. The runner reads the
  worktree's changes over the link; the API serves them to the owner.
- **Postponed** by the owner the same day: **Files** (a tree and a
  viewer), the **Editor** view (the file tree or the changed files on the
  left, the file or the diffs in the middle, the chat docked on the right)
  and **Source control** (stage, commit, push, open a pull request). The
  view switch is Terminal and Chat until Editor comes.
