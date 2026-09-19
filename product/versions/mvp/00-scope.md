# 00 — Scope

## In one line

Orca, as a hosted web app: connect a host you own, then run sessions
on it. No virtual machines in the MVP. Claude Code first, Codex next.

## Decided

- **Personal workspace.** One user. Teams and multiplayer come later
  on the same users table with an org membership added.
- **Sign-in on day one: GitHub, Google, and email plus password**, from
  a base project that already ships account linking (Better Auth on
  Hono or equivalent). Connect GitHub is a separate step after sign-in:
  the App installation with all or selected repositories, attached to
  whatever account you signed in with (note 09). Identity and
  repository access are two different things.
- **Hosts are your own machines, direct mode** (note 02 mode A). The
  runner runs as your user on the host, installed with one command that
  carries a one-hour registration token; it generates a keypair, dials
  out to the control plane, and stays connected. Linux and macOS.
- **A session is a worktree plus a terminal on a host.** No VM, no
  container. The runner creates a git worktree under the fixed layout,
  starts a tmux session in it, launches the agent, and streams the PTY
  to the browser.
- **Fixed layout on every host:**
  `~/oppenheimer-ai/workspaces/<repo>/main` (the fetch source, never
  edited) and `~/oppenheimer-ai/workspaces/<repo>/worktrees/<slug>`
  (one per session) — superseded by 10: the layout is now
  `workspaces/<org>/projects/<project>/{repos,sessions}`. Agent
  personalities and the like come later.
- **Create session chips:** host, repositories (several, each with its
  base branch), agent. Agent is Claude Code in the MVP; Codex is the
  next entry.
- **Agent login is the host's own.** The runner launches `claude` with
  the host's existing config; you log in once per host by typing it in
  the terminal, and the login URL becomes a button. No account objects,
  no volumes, no config-dir switching yet (note 06 comes later).
- **GitHub access for clone and push:** the runner obtains a one-hour
  installation token scoped to the session's repository from the
  control plane and exposes it through a git credential helper bound
  to that session's shell. Nothing written to disk (note 02 §"Mode A"
  option 2).
- **Sidebar** of sessions with a state dot from screen manifests
  (working, blocked, idle) and a name. Tabs are tmux windows in the
  session's own tmux session: window 0 is the agent, tabs 1 and up are
  plain shells in the same worktree (02 §tmux).
- **No ports on the host, ever.** The runner holds one outbound
  WebSocket to the control plane; the browser connects to the control
  plane; the control plane relays. Tailscale is an optional fast path
  later, never a requirement.
- **Onboarding is four screens**: sign in, connect GitHub, add a host
  (paste one command or hand an agent the install prompt), create the
  first session on the real New session screen with chips prefilled
  (05 §onboarding).
- **Sleep is not a platform concern.** The host is always on; tmux
  keeps sessions alive; the browser reattaches. Closing a session
  pushes the branch and removes the worktree.
- **Hosted control plane** in the same Hetzner region as your hosts,
  public HTTPS for the browser, outbound WebSocket from runners.
- **The runner keeps itself current**, and three things hold whatever
  the policy around them turns out to be: an update is a signed
  artifact, the control plane can offer a version but never mint code,
  and sessions survive the swap because they live in tmux. When it
  applies — channels, the quiet window and what overrides it — is 09 §5,
  and that is the only place those clocks are written.

## Out, for later slices

Virtual machines in any form (Shared workspace VM, Clean VM,
Firecracker, tart, cloud adapters), sleep tiers, account objects and
volumes, the egress proxy, Codex and other agents, Create PR and diff
view, preview URLs, auto-fix and routines, usage meters, delegation,
Tailscale mode, orgs and billing, agent personalities and any other
directory under `~/oppenheimer-ai`.

The VM design already written (notes 08, 10, 11 §2 and §5, and the VM
parts of the documents in this directory) stays as the next slice. It
is not deleted, it is deferred.

## The demo scene

You tap Continue with GitHub on your phone and pick the repositories
the app may see. In Settings you add a host: copy one command, run it
on your Mac Studio or your Hetzner box, and the host appears online.
New session: host `mac-studio`, repo `xrp-mobile`, branch `main`, agent
Claude Code. A terminal appears in a fresh worktree with `claude`
running. You tap the login URL once on that host, give the task, close
the phone. On the laptop the session is still there. You open three
more and switch in the sidebar.

## Done means

- The scene runs on a real Mac and a real Linux host from a phone.
- Closing the browser, losing wifi, and restarting the runner do not
  kill a session.
- No GitHub token is ever stored by the control plane beyond the
  one-hour scoped tokens it mints, and none is written to a host's
  disk. No vendor credential is ever stored by the platform.
- `docker compose up` brings the control plane up on a fresh machine.

## Open questions

1. ~~Tabs~~: decided, tmux windows in one tmux session per session
   (02 §tmux).
2. ~~Session naming~~: decided, derived from the first prompt by a fast
   model, with an opaque minted slug as the fallback and an optional
   typed name (10).
3. ~~Branch chip~~: decided, the base for a new session-named branch,
   chosen per repository; never an existing branch directly (10).
4. Should the runner refuse to start a session if the host has no
   `claude` login, or start it and let the login prompt appear? Let it
   appear; that is the flow.
