# Lessons from herdr and from a minimal SSH web terminal (formerly note 13)

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

> **2026-11-02:** true of herdr 1, not of herdr-core, its successor: a
> holder process owns the terminals there, so programs survive a restart
> or an update of the core. §4 reads it and measures it against ours.

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

> **2026-11-02:** herdr-core drops screen detection altogether and takes
> status only from the program itself (OSC 7501), which Claude Code now
> speaks. We keep the manifests below as the fallback and put the agent's
> own word above them (§4).

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

> **2026-11-02:** the verdict stands for the structure. What §4 adds is
> what herdr-core does that we did not: the agent's own status, agents
> starting agents, and terminals that come back after a reboot.

## 4. herdr-core, read and measured (2026-11-02)

herdr is now three Apache-2.0 Rust repositories:
[`herdr-core`](https://github.com/herdrdev/herdr-core) (`hc`, 0.1.16 of
2026-10-31, ~28k lines), a runtime that keeps terminals alive and relays
their bytes to any viewer and "draws nothing";
[`herdr-app`](https://github.com/herdrdev/herdr-app), a native desktop
client on libghostty and Vulkan with JavaScript mods; and herdr 1, the
terminal app §1 read. herdr-core's rules are worth quoting, because two of
them are the opposite of what §1 took from herdr 1: "Status comes only from
OSC 7501. No screen detection, no agent registry, no vendor-specific logic",
and "Core is a runtime, not a multiplexer".

### What it does that we did not

- **Survives its own restart.** A holder process is every program's parent
  and keeps a ~1 MB tail per terminal; the core restarts or updates beside
  it, and a crashed core is restarted by the holder.
- **Status from the program.** OSC 7501, the Program Status Protocol: a
  program reports `idle`, `working`, `done`, `blocked` (with `permission`,
  `question` or `auth`), or `error`, with a progress figure and a message,
  as `ESC ] 7501 ; state=…:kind=…:msg=<base64> ST`. Claude Code speaks it
  from 2.1.295, **but only after the terminal answers its `OSC 7501 ; ?`
  probe** (read off the 2.1.316 binary, and confirmed live). tmux 3.4
  answers DA1 and not that probe, so inside our panes Claude Code said
  nothing at all.
- **Agents run agents.** `hc run --bg` starts a helper as the caller's
  child, `hc send` types into it, `hc wait --children all` waits, and a
  child's report arrives in the parent's own input as `<hc from="…">`;
  children end with their parent unless `--outlive-parent`.
- **Typing like a program.** A message is pasted, then the submit key goes
  in after a 200 ms gap, once the agent has reported; templates name the
  submit and stop keys per agent.
- **Kept terminals.** `--keep` brings a terminal lost to a reboot back as a
  fresh shell in its last folder, never rerunning its command, with a
  backoff of 1.5 s doubling to a minute.
- **An API that only grows.** A frozen copy of the released schema, and a
  test that fails on any change an older client would break on.

### Measured

`herdr-bench/` (its README says how to run it) drives tmux as the runner's
adapter does, herdr-core over its socket, and a bare PTY, on one 4-vCPU
Linux machine (tmux 3.4, herdr-core 0.1.16). Key to echo, ms, p50 / p99:

| | bare PTY | tmux (runner) | herdr-core |
|---|---|---|---|
| idle | 0.11 / 0.51 | 0.21 / 0.65 | 0.29 / 0.65 |
| a neighbour printing ~2 MB/s, watched | 0.10 / 0.49 | 0.22 / 1.98 | 0.31 / 2.86 |
| a neighbour printing flat out, unwatched | 0.11 / 0.31 | 1.00 / 2.53 | 0.33 / 2.76 |
| a neighbour printing flat out, watched | 0.06 / 2.54 | 0.99 / 2.45 | 0.86 / 58.7 |

Bulk output (15 MB of `seq`): 0.89 s on a bare PTY, 1.53 s through tmux
(5.3 MB reached the viewer, 1.5 s of tmux CPU), 0.76 s through herdr-core
(all 16.9 MB, 0.86 s of CPU). Reading a screen: 2.5 ms per `capture-pane`
exec, 0.9 ms over herdr-core's socket. Memory: 2.9 MB for tmux with 50 idle
shells, 7.8 MB for herdr-core; after the output-heavy runs, tmux held 154 MB
it never gave back, herdr-core 11 MB. herdr-core was serving again 18–35 ms
into an update restart with every program and screen kept; after a crash
the program survived every time, back in ~19 ms when a client started a
core and 3 s (then backing off) when the holder did. **Found:** a crash
after an update comes back with an empty screen, reproduced on its own.

So: typing is the same at the scale a browser can feel (the relay adds tens
of milliseconds); tmux's single-threaded server taxes every session for one
busy terminal and halves bulk throughput; herdr-core forwards every byte, so
one watched terminal printing flat out hurts its neighbours more and costs a
viewer three times tmux's bytes, which for us means the relay. Swapping
tmux for herdr-core buys neither speed nor survival we lack; the gaps were
the agent's own status and the behaviours above.

### What we ported (the runner, 2026-11-02)

- **OSC 7501 under tmux.** Window 0 runs the agent under `runner pty`
  (`apps/runner/internal/sessions/adapters/statuspty`), a PTY of its own
  that answers the probe, keeps the reports in a file per session and
  passes every other byte through. The poll loop takes that report over the
  screen manifests while the wrapper lives; the manifests stay for agents
  that say nothing, and the screen alone still names a vendor login.
  `agent.observed` carries the report, the API folds it into
  `work_session.agentReport`, and the session bar says why the agent waits
  ("Needs your permission · approve Bash: …"). Verified against Claude Code
  2.1.316 in tmux: idle → working → done, and blocked/permission.
- **Agents run agents.** `runner sessions run|send|wait|report|children`,
  on the daemon's local socket: a child runs in its parent's folder (or a
  worktree of its own with `--repo`), notes reach the parent as
  `<oppenheimer from="…" state="…">`, and children end with their parent
  unless `--outlive-parent`. `runner --skill` is the manual, which every
  session's note points at.
- **Typing like a program.** The agent catalog's `input` (`submit`, `stop`,
  `pasteGapMs`, herdr-core's values); a message waits for its agent to be
  up and refuses after 30 s (`SESS_012`), which is what a dialog the person
  must answer looks like.
- **Kept sessions.** `runner sessions keep`: a session lost to a reboot is
  restarted on its own with herdr-core's backoff. Ours reopens the agent's
  conversation where herdr-core gives a fresh shell.
- **The link only grows.** `packages/shared/protocol-schema/released.schema.json`
  and `released-protocol.spec.ts`.

### Not taken

herdr-core itself under the runner (it would add a Rust and Zig build, a
preview protocol with one maintainer, an update path checked only by
SHA-256 over HTTPS, and every byte on the relay); its SSH machines, its
JSON document store and the desktop app; and the 3 s of quiet herdr-core
waits after a person last typed before an agent's message goes in, which
needs the runner to see the browser's keystrokes on the way to tmux. A
child the daemon starts is the host's: the control plane refuses its
events, so the console does not list it yet.
