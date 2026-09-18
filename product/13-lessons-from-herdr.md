# 13 — Lessons from herdr and from a minimal SSH web terminal

Two codebases read in full after the runner was built, to check the
architecture against prior art: `herdrdev/herdr` (Rust, ~366 source
files, Apache-2.0) and `wuchihsu/go-ssh-web-client` (Go, 340 lines).
Note 03 already cited herdr from its website; this note is from the
source.

## 1. herdr

**What it is.** A terminal workspace manager for coding agents: one
Rust binary, a background server, a TUI client, panes marked working /
blocked / idle, several machines in one window over SSH, worktrees,
plugins, and an agent-facing socket API. Closest thing to our product
that exists, and it arrives from the other end — local-first, terminal
UI — where we arrive from the browser.

**Shape of the code.** `src/server` and `src/client` either side of
`src/ipc.rs` and `src/protocol`; `src/pty/actor` owning the terminals;
`src/persist` for snapshot and restore; `src/remote` for SSH machines,
with its own `restart_policy.rs`; `src/detect` for agent state;
`src/update.rs` for self-update. The split matches ours almost
line for line — the difference is where the process boundary falls.

### The one architectural fact worth the read

herdr owns the PTYs in its own server process. Its README is explicit
about the consequence: after a server or machine restart it restores
the saved layout and can resume *supported* agents, but **the original
processes do not survive**.

We put tmux between the runner and the processes. A runner restart, an
update and a rollback all leave the agent running, because the tmux
server is a sibling process tree, not a child (which is why our service
units are written with `KillMode=process` and `AbandonProcessGroup`).

That is a trade, not a win on every axis:

| | herdr | us |
|---|---|---|
| Process survival across a client/server restart | layout restored, processes restart | processes untouched |
| Terminal fidelity | full — owns the emulator: splits, mouse, image protocols | whatever tmux gives |
| Moving parts on the host | one binary | binary + tmux |
| Attach latency | in-process | one PTY hop through `tmux attach` |

For a browser product where the machine is remote and the session must
outlive the tab, the wifi, and an upgrade of our own binary, surviving
processes is the feature. Our note 01 already chose the terminal as the
primitive; this is the same choice one level down, and herdr is the
evidence for what the alternative costs.

### Agent state: what we were getting wrong

herdr's `src/detect` is **versioned data, not code**: one TOML manifest
per agent (`claude.toml`, `codex.toml`, and twenty more), each rule
carrying an id, a state, a **priority**, a **region** of the screen, a
set of regexes, and a set of `not` guards. Regions include
`bottom_non_empty_lines(12)`, `last_non_empty_above_prompt_box` and —
the good one — `osc_title`, the terminal title the agent sets through
an escape sequence, which is a far more reliable signal than scraped
body text. Manifests carry `version` and `min_engine_version` and
update independently of the binary.

Above that, `src/terminal/state.rs` arbitrates: **lifecycle hooks are
authoritative while an agent is live, and screen reading is the
fallback** for agents without hooks, with hook authority cleared on
process exit.

Three of those land directly on our open question 2 in
`versions/mvp/02-runner.md`:

1. **Hooks beat scraping** where an agent has them. Scraping stays as
   the fallback, and the arbitration lives in one place. The open
   question is now answered.
2. **Priority plus `not` guards**, not a chain of ifs. A spinner frame
   is usually still on screen under a question that has just appeared;
   first-match-wins reports "working" for a session that is in fact
   stuck, which is the exact failure the sidebar exists to prevent.
   Implemented in `internal/sessions/adapters/manifest`.
3. **Manifests want to be data the control plane ships**, so a Claude
   Code release that changes its spinner does not need a runner
   release. Ours are a Go rule table today, deliberately shaped so the
   move is mechanical.

### Updates

herdr's update manifest is the same shape as ours — channel, per-target
URL, sha256 — with two differences: its digest is optional, and there
is no signature; trust rests on HTTPS and on Homebrew. Ours requires a
digest *and* an offline-key signature, and refuses to update at all
when no key is compiled in. We keep that; it is finding F26, and a host
agent that can be handed code by whoever serves the manifest is a
different product from one that cannot.

### Not taken

Owning the terminal emulator, the plugin marketplace, the TUI client,
and SSH as the transport to other machines. Each is right for a
local-first tool and wrong for a browser product with an outbound
agent — and each is a large surface we would then own.

## 2. wuchihsu/go-ssh-web-client

340 lines: xterm.js in the browser, one WebSocket to a Go process,
`golang.org/x/crypto/ssh` out to the host, a PTY on the SSH session.
Useful as the smallest honest version of the bridge we are building for
the `link` slice — and as a list of the things that make the difference
between a demo and a product:

- **No persistence.** Close the tab and the shell is gone. There is no
  tmux, no ring buffer, no replay. This is the single reason our design
  puts tmux underneath.
- **Polling instead of blocking.** `time.Sleep(10 * time.Millisecond)`
  between reads adds latency and burns CPU where a blocking `Read` in a
  goroutine costs neither.
- **512-byte buffers** for PTY output, so a build's output is chopped
  into thousands of frames. Ours reads 32 KB.
- **Frame types inverted.** PTY bytes go as text frames and the resize
  message as binary. Bytes are binary and control messages are JSON —
  that was already our decision (01 §framing); this is the worked
  example of what the other way costs.
- **`ssh.InsecureIgnoreHostKey`**, which the file itself flags as not
  for production. Our equivalent is the pinned control-plane
  fingerprint (F6), and it is not optional.
- **No flow control**, so a runaway process floods the socket. We ack
  consumed bytes and pause the PTY (01 §flow control).
- A goroutine leak worth remembering: two goroutines both send on a
  `closeSig` channel of capacity one, and the second blocks forever.

## 3. Verdict

The architecture holds. The split we designed — outbound agent, control
plane relay, tmux underneath, screen manifests on top — is the same
decomposition herdr arrived at, with the process boundary moved one
notch for survivability and the trust model tightened around updates.
What we take is not structure but craft: manifests as versioned data
with priorities and guards, hooks over scraping, and the terminal title
as a first-class signal.
