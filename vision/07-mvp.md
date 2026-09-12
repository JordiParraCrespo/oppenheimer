# 07 — The MVP: a personal workspace of sessions in VMs

> In one line: **Orca's core, rebuilt as a hosted web app, with a VM on
> your own host under each session instead of your laptop.** Same
> sidebar, worktrees, terminal, tabs, and account switcher. Different
> in where it runs, how it starts (one GitHub flow, clone on demand),
> and that sessions sleep for free. No editor, browser, design mode,
> or mobile app.

Decision from discussion, after seeing the console mockups: the MVP is
a **personal workspace** where you create **sessions**, each one a
**VM on a host you own**, and each session is **just a terminal**, as
in Orca. The Create session screen is the product. The sidebar lists
sessions. There is no enterprise layer.

## 1. The scene

You open the console on your phone, tap Continue with GitHub, and pick
which repositories the app may see. The sidebar
lists your sessions with a colored state dot. You click **New session**
and set the scope with four chips: host `optimus`, repo `xrp-mobile`,
branch `main`, agent `Codex`. You type a name, or a first task, and
press go. A VM boots on `optimus`, the repo is cloned at `main`, and a
terminal appears with `codex` already running on your account. You tap
the login URL once if that host has never seen this account. You give
the task and close the phone. On the laptop the session is still there.
You open three more the same way and switch between them in the sidebar.

## 2. What a session is

- **A VM** on a host you own. The MVP host is the existing Hetzner
  runner host, so the backend is **libvirt/KVM with the existing golden
  image pipeline** (note 08). Firecracker becomes a later cold-start
  optimization; tart for Mac hosts comes later. 4 vCPU, 8 GB by default. Docker inside. **Lifetime: paused when
  idle, resumed on the next visit, destroyed only when you close the
  session.** Pause keeps memory, so the tmux server, the agent process,
  and the terminal scrollback come back exactly as they were. Rebuilding
  from a snapshot is not used for live sessions; snapshots are only a
  boot accelerator for new ones.
- **A worktree** under `~/oppenheimer-ai/workspaces/<repo>/worktrees/`
  created from that repo's `main/` checkout at the chosen branch (note
  11). The host chip carries a runtime: **Shared workspace** (one
  long-lived VM per repo per host, a worktree per session) or **Clean
  VM** (a VM for this session alone, Docker inside, nothing else
  running, for anything that starts services). **This machine**, the
  direct runtime for the Mac Studio with simulators, is the second slice
  after the MVP. The clone uses a token the VM never holds for long
  (note 09).
- **A terminal**, tmux-backed, streamed to the browser, with the chosen
  agent launched in it. Extra tabs open more terminals into the same VM.
- **An account**: the agent's config dir points at that account's own
  persistent volume, one volume per account, attached to the VM that
  selected it. Login survives across VMs (notes 01 §7 and 06). Two
  sessions with two different accounts on one host attach two different
  volumes. The same account in two VMs at once is not allowed in the
  MVP, since a block device can be mounted by one VM at a time; the
  account chip shows it as in use. tart hosts, later, share the directory
  instead and will not have this limit.

Nothing is rendered as chat. The terminal is the whole session view.
Anything with structured output, chat bubbles, or a model picker is a
later idea, not the MVP.

## 3. Screens

1. **Sign in.** One button, Continue with GitHub, which is also the App
   installation with all or selected repositories (note 09). Google and
   email come later if ever.
2. **Sidebar.** Sessions with a state dot, name, and age. New session at
   the top. Your name at the bottom. Hosts and accounts live under a
   small settings drawer, not in the main navigation.
3. **New session.** The four chips, host, repo, branch, agent, plus a
   lifetime toggle, Keep or Ephemeral (note 10 §10), and a text box for
   a name or a first task. Chips remember the last choice.
4. **Session.** Terminal full-bleed. Tabs for more terminals. A thin
   status line: host, branch, account, usage meters for the active
   account if the CLI exposes them, permissions mode. Login URLs printed
   by the CLI become a button.
5. **Settings drawer.** Hosts (install command with a one-hour token,
   online dot, backend), accounts (add by running the login in a
   terminal, per note 06).

## 4. In and out

| In | Out, on purpose |
|----|-----------------|
| Personal workspace, one user, GitHub sign-in | Orgs, teams, sharing, billing |
| Hosts you own, registered with the token and keypair flow | Cloud provider adapters |
| Shared workspace VMs and Clean VMs on libvirt/KVM on the existing Hetzner host, reusing the runner codebase | Firecracker cold-start path, tart for Mac hosts, the This-machine runtime on the Mac Studio (second slice after the MVP) |
| Repo and branch chips backed by the GitHub App installation (all or selected repositories, note 09) | Create PR button, diff view, auto-fix, routines |
| Agent chip: Codex first | Claude Code next, then Kimi, OpenCode, Gemini |
| Accounts per host, one persistent volume per account, selected per session | Usage-based account routing |
| Terminal with reattach, tabs, phone layout | Chat rendering, editor, embedded browser, preview URLs |
| Sidebar state dot from screen manifests, working / blocked / idle | Delegation between sessions |
| Scoped one-hour GitHub token delivered by cloud-init seed, as the runner config is today | Host egress proxy with token injection (next slice), signed auto-update |

## 5. What changed from the previous cut

The previous version of this note was "sessions only, on direct-mode
machines, no GitHub, no accounts". The mockups made three things
non-negotiable: the session runs in a VM, the Create session screen
carries repo and branch, and the agent is picked at creation. That
pulls mode B, the GitHub App with proxy-injected tokens, and the account
object into the MVP. It also fixes an earlier worry from the mockups:
the session view is a terminal, not a rendered chat, so the Agent SDK
stays out.

## 6. Order of work

| Step | You can now | Size |
|------|-------------|------|
| 1 | Runner on the Linux host, one page, tmux-backed terminal in the browser, close and reopen, still there. The status line shows measured keystroke echo; done means under 50 ms median from Barcelona to the Hetzner host on wifi | 1 week |
| 2 | The runner boots a libvirt guest from a new golden image revision, guest agent over vsock, terminal inside, suspend and hibernate when idle, resume by agent session id, destroy on close | 1 week |
| 3 | Continue with GitHub as one flow (identity plus App install with all or selected repos), register a host, sidebar and New session with host and agent chips | 1 week |
| 4 | Repo and branch chips: reuse the App auth and token minting, deliver the token by seed, clone into the VM | 1 week |
| 5 | Accounts: one volume per account, add a Codex account via login, per-session selection, login URL button | 1 week |
| 6 | State dots from screen manifests, tabs, phone layout, reconnect polish | 1 week |

About six weeks for one person. Step 2 is the new gate next to step 1:
the guest must be usable within a minute of Go and the terminal inside
it must feel like the one in step 1.

## 7. Done means

- The scene runs on the Hetzner host from a phone browser, with a Codex
  session in a KVM guest cloned from a private repo.
- Closing the browser, losing wifi, and restarting the runner do not kill
  a session. Closing the session destroys the VM.
- No GitHub token or vendor credential is ever inside a VM image or the
  control plane database.
- Two sessions on one host run two different Codex accounts at once,
  each on its own account volume. Two Keep sessions on one repo share
  a workspace VM and appear as two worktrees.
- A cold clone plus `docker compose up` brings up the control plane.

## 8. Decisions that closed the open questions

- **Host:** the MVP host is the existing Hetzner runner host. The VM
  backend is libvirt/KVM reusing the GitHub Actions runner codebase
  (note 08). Firecracker and tart are later slices.
- **Agent:** Codex first. Claude Code is the next agent in the chip,
  then the rest. Everything in note 06 applies to Codex through
  `CODEX_HOME` and `auth.json`, with hooks trusted via `trusted_hash`.
- **Control plane:** hosted by us and fully web based, in a different
  place from the runners. Browsers reach it over public HTTPS; the
  runner reaches it over the tailnet. Nothing to install for the user
  except the runner on their host.
- **VM lifetime:** pause after ten idle minutes, suspend after two
  hours, hibernate after a day, wake on visit, destroy on close (note 10).

## 9. Parked for after the MVP: preview URLs

A URL to inspect what a session is running, the way Codespaces forwards
a port or a hosted preview exposes an app. Shape when it comes:

- The runner detects listening ports in the guest (the port scanner
  Orca already has) and shows them on the session bar.
- Clicking one opens `https://<session>-<port>.preview.<our domain>`,
  served by the control plane's relay through the same runner link,
  gated by the user's login. Optional public toggle per port with an
  expiry, for showing someone a build.
- On the tailnet, the same port is also reachable directly at the
  host's tailnet address, no relay.

Nothing about it changes the MVP; it rides on the relay and the vsock
channel that exist by step 2. Second slice after the MVP, next to the
Mac runtime and Create PR.

## 10. Latency budget

Keystroke echo from Barcelona to the Hetzner host, with the control
plane in the same Hetzner region:

| Hop | Typical |
|-----|---------|
| device to control plane | 30 to 40 ms round trip |
| control plane to runner over the tailnet, same datacenter | 1 to 2 ms |
| runner to guest over vsock, tmux, back | under 1 ms |
| xterm.js render | one frame |
| total | about 35 to 50 ms, the same as SSH to the same host |

Three rules that follow:

1. **The control plane lives next to the hosts.** Falkenstein or
   Nuremberg for a Hetzner host. Never a different continent. This is
   the one placement decision that decides feel.
2. **Local echo prediction** in the page, Mosh-style, via the xterm.js
   addon, so typing feels local even on a bad link.
3. **Direct path on the tailnet.** When the browser's device is on the
   tailnet, the page connects to the host directly and skips the relay,
   like Orca over SSH. Off the tailnet it uses the relay. Same page.

Step 1 measures this and shows it in the status line. It is not done
until the number is under 50 ms median from your laptop.

## 11. Web stack: a client app, not server components

The console is a real-time client: xterm.js over a WebSocket, a live
sidebar, an installable PWA that survives flaky links. Server rendering
buys nothing there and RSC adds a second runtime and a server-client
boundary in every component. Decision: **Vite + React SPA** with
TanStack Router and Query, talking to the Hono control plane over HTTP
for data and one WebSocket for the terminal and live updates. Sign-in
and any marketing page are static. If a content-heavy public site ever
appears, it is a separate Next.js site; the console stays a SPA.
