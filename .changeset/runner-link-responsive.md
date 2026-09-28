---
"@oppenheimer/runner": patch
---

Keep the link's read loop responsive and serialise updates.

- `host.update` and `host.preflight` run off the read loop, each on a lane of its own and on the daemon's context, so **Update now** on a slow connection no longer stops the pongs, drops the link and cancels its own download. A preflight collects the host once, not twice.
- A browser's keystrokes go to a bounded queue per attachment that one goroutine writes to the PTY; a wedged `tmux attach` client closes its own attachment (`attachment.closed`, "input stalled") instead of stalling the link.
- `session.resize` for an open attachment is applied inline, not behind the session's lane; one for an attachment still opening keeps its place behind the attach.
- An attach whose PTY opens after its link dropped is closed rather than streamed on the next link under an id that link may have given someone else.
- `Updates.Apply` and `Rollback` run one at a time in the process, and staging uses unique file names, so the periodic check, **Update now** and `runner update` never download into the same file.
- Event batches refused with backpressure while the link stays up are retried every 5 s in order, a flush stops at the first refusal, and at most 4096 batches wait (the oldest is dropped with a warning).
