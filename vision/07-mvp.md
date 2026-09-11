# 07 — The MVP: a personal workspace of sessions in VMs

Decision from discussion, after seeing the console mockups: the MVP is
a **personal workspace** where you create **sessions**, each one a
**VM on a host you own**, and each session is **just a terminal**, as
in Orca. The Create session screen is the product. The sidebar lists
sessions. There is no enterprise layer.

## 1. The scene

You open the console on your phone and sign in with GitHub. The sidebar
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
- **A clone** of the chosen repo at the chosen branch, inside the VM,
  using a token the VM never sees (note 02).
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

1. **Sign in.** GitHub only. Google and email come later if ever.
2. **Sidebar.** Sessions with a state dot, name, and age. New session at
   the top. Your name at the bottom. Hosts and accounts live under a
   small settings drawer, not in the main navigation.
3. **New session.** The four chips, host, repo, branch, agent, and a text
   box for a name or a first task. Chips remember the last choice.
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
| Mode B: VM per session, libvirt/KVM on the existing Hetzner host, reusing the runner codebase | Firecracker cold-start path, tart for Mac hosts, mode A direct-machine sessions |
| Repo and branch chips backed by the GitHub App installation (all or selected repositories, note 09) | Create PR button, diff view, auto-fix, routines |
| Agent chip: Codex first | Claude Code next, then Kimi, OpenCode, Gemini |
| Accounts per host, one persistent volume per account, selected per session | Usage-based account routing |
| Terminal with reattach, tabs, phone layout | Chat rendering, editor, embedded browser |
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
| 1 | Runner on the Linux host, one page, tmux-backed terminal in the browser, close and reopen, still there | 1 week |
| 2 | The runner boots a libvirt guest from a new golden image revision, guest agent over vsock, terminal inside, `managedsave` when idle, destroy on close | 1 week |
| 3 | Sign in with GitHub, install the App with all or selected repos, register a host, sidebar and New session with host and agent chips | 1 week |
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
  each on its own account volume.
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
- **VM lifetime:** pause while idle, resume on visit, destroy on close.
