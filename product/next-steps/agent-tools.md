# Agent tools: an agent in a session reaches the person

**Goal:** an agent working in a session can reach the person without them
watching its terminal. These four come from the tools Claude Code has in
its own cloud sessions and were set by the owner on 2026-11-02:

| § | Tool | The agent runs | The person sees |
|---|------|----------------|-----------------|
| 1 | Send a file | `runner sessions send-file <path> [--caption "line"]` | the file in the session's chat: an image as a picture, a small text file as its text |
| 2 | Notify | `runner sessions notify "line"` | an item in the Inbox |
| 3 | Wake on a pull request | `runner sessions watch-pr <number>` | nothing; the agent is told when its PR's checks finish or someone reviews it |
| 4 | Wake later | `runner sessions wake-in <duration> "message"` | nothing; the message is typed into the session when it is due |

They share one shape: the agent runs a `runner` command in its terminal,
which reaches the runner's daemon over its local socket (as
`runner sessions report` does, `../versions/mvp/02-runner.md`), and the
command is taught to every agent by `runner --skill`
(`apps/runner/internal/cli/skill.md`). A question with options (the
`AskUserQuestion` card) is already the Inbox's slice 4
(`../versions/mvp/29-inbox.md`), so it is not here.

## 1. Send a file (built 2026-11-02)

- **The command.** `runner sessions send-file <path> [--caption "line"]`,
  from inside a session (`OPPENHEIMER_SESSION`). The path is resolved
  against the agent's folder and sent to the daemon absolute
  (`POST /v1/sessions/{id}/files` on the local socket,
  `apps/runner/internal/cli/share.go`).
- **Any regular file the runner's user can read.** The agent runs as that
  user and could copy any file into its checkout first, so a narrower rule
  (the worktree only) keeps nothing from the person, who is the one it is
  shown to. A directory, a device or a missing file is `SESS_013`.
- **What travels.** The daemon keeps one chat entry per shared file,
  `oppenheimer.file` (`transcript/shared.go`): an id, when, the name, the
  absolute path on the host, the size, the media type (by extension, else
  sniffed), the caption (500 bytes at most), and as much of the file as fits
  the link's 64 KB for one chat entry: a JPEG preview of an image (the
  chat's own `previewBytes`, 1600 px down to 240 px), or the text of a text
  file of 32 KB or less. A file over 25 MB is not read; it goes by name.
  The file itself stays on the host.
- **Where it is kept.** Under the session's own files,
  `~/.oppenheimer/images/<session>/shared/`, one JSON file each, named by
  when, so the session's clean-up takes them with it.
- **How it reaches the console.** Nothing new on the link: the chat
  follower (`transcript/follow.go`) sends every shared entry after the
  history, the way it sends the status line's figures, and each new one as
  it is kept. Every attachment sends them all again, so a reload or a
  second tab sees them; the console holds each once by its id.
- **Where it is drawn.** The console places each file in the turn that had
  started when it was shared, between the steps written around it
  (`session-chat-files.ts`), and draws it as a card: the caption, the
  picture as a tile that opens whole, or the text on the terminal's ground
  with a download, then the name, size and folder on the host. A file with
  neither says it stays on the host.
- **Not yet.** Opening the full file (an image larger than its preview, a
  PDF, anything over 32 KB) needs the console to ask the host for it over
  the relay; there is no such request today (`links/` has the
  request-and-reply pattern to copy, `relay-host-folders.adapter.ts`). An
  OpenCode session's chat is read through OpenCode's API, not the
  follower, and does not show shared files yet. Codex, Grok and Claude
  Code sessions do.
