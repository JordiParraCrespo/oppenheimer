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
branch `main`, agent `Claude Code`. You type a name, or a first task, and
press go. A VM boots on `optimus`, the repo is cloned at `main`, and a
terminal appears with `claude` already running on your account. You tap
the login URL once if that host has never seen this account. You give
the task and close the phone. On the laptop the session is still there.
You open three more the same way and switch between them in the sidebar.

## 2. What a session is

- **A VM** on a host you own: tart on a Mac host, Firecracker on a Linux
  host. 4 vCPU, 8 GB by default. Docker inside. Torn down when you close
  the session, paused when idle.
- **A clone** of the chosen repo at the chosen branch, inside the VM,
  using a token the VM never sees (note 02).
- **A terminal**, tmux-backed, streamed to the browser, with the chosen
  agent launched in it. Extra tabs open more terminals into the same VM.
- **An account**: the agent's config dir points at your account's home
  on the host's persistent volume, so login survives across VMs (notes
  01 §7 and 06).

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
| Mode B: VM per session, tart on macOS, Firecracker on Linux | Mode A direct-machine sessions (they come back as a chip option later) |
| Repo and branch chips backed by the GitHub App and proxy-injected tokens | Create PR button, diff view, auto-fix, routines |
| Agent chip: Claude Code first, Codex second if time allows | Kimi, OpenCode, Gemini in the chip |
| Accounts per host with per-session selection | Usage-based account routing |
| Terminal with reattach, tabs, phone layout | Chat rendering, editor, embedded browser |
| Sidebar state dot from screen manifests, working / blocked / idle | Delegation between sessions |
| Egress proxy on the host, since VMs must not hold tokens | Tailscale mode, signed auto-update |

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
| 1 | Runner on `optimus`, one page, tmux-backed terminal in the browser, close and reopen, still there | 1 week |
| 2 | The runner boots a VM on that host, opens the terminal inside it, tears it down on close | 2 weeks |
| 3 | Sign in with GitHub, register a host, sidebar and New session with host and agent chips | 1 week |
| 4 | Repo and branch chips: GitHub App, token minting, egress proxy on the host, clone into the VM | 2 weeks |
| 5 | Accounts: persistent home volume, add account via login, per-session selection, login URL button | 1 week |
| 6 | State dots from screen manifests, tabs, phone layout, reconnect polish | 1 week |

About eight weeks for one person. Step 2 is the new gate next to step
1: the VM must boot in a few seconds and the terminal inside it must
feel like the one in step 1.

## 7. Done means

- The scene runs on a real host from a phone browser, with a Claude
  Code session in a VM cloned from a private repo.
- Closing the browser, losing wifi, and restarting the runner do not kill
  a session. Closing the session destroys the VM.
- No GitHub token or vendor credential is ever inside a VM image or the
  control plane database.
- Two sessions on one host run two different Claude accounts at once.
- A cold clone plus `docker compose up` brings up the control plane.

## 8. Questions still open

1. Is `optimus` a Mac or a Linux box? It decides whether tart or
   Firecracker is built first.
2. Codex in the MVP agent chip, or Claude Code only?
3. Control plane on one of your hosts via docker compose, or hosted?
   Personal suggests self-hosted; phone-first wants an always-on endpoint.
4. VM lifetime: paused while idle and resumed on the next visit, or
   rebuilt from a snapshot each time?
