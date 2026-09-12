# 00 — Scope

## Decided

One line: Orca's core, rebuilt as a hosted web app, with a VM on your
own host under each session instead of your laptop.

- Personal workspace. One user. Continue with GitHub is the only sign-in
  and is also the App installation with all or selected repositories.
- Hosts you own, registered with a one-hour token and a keypair. The
  MVP host is the Hetzner i7-6700 box running the existing runner
  controller.
- Sessions are terminals. No chat rendering, no Agent SDK.
- Create session chips: host with runtime (Shared workspace or Clean
  VM), repo, branch, agent (Codex), lifetime (Keep or Ephemeral).
- Fixed layout: `~/oppenheimer-ai/workspaces/<repo>/{main,worktrees/<slug>}`.
- Lifetime is chosen per session. **Keep**: pause after 10 idle
  minutes, suspend after 2 hours, hibernate after a day, destroy only on
  close; sleeping is free. **Ephemeral**: after the idle timeout the
  runner auto-pushes the working branch, keeps the scrollback in the
  session log, and destroys the VM and overlay; only the pushed branch
  and the account volume survive (note 10 §10). Sleep is driven per
  runtime VM, not per session: a Shared workspace VM sleeps only when
  every session in it is idle.
- Accounts: one persistent volume per account, selected per session.
- Sidebar with state dots from screen manifests.
- Hosted control plane in the same Hetzner region, public HTTPS for the
  browser, tailnet for the runner.

## Out

Claude Code and other agents in the chip (next), the Mac Studio
runtime, Create PR and diff view, preview URLs, auto-fix and routines,
usage meters, delegation, cloud adapters, Firecracker, Tailscale mode
for the control plane itself, signed auto-update, orgs and billing.

## The demo scene

See `../07-mvp.md` §1. The MVP is done when that scene runs on the real
host from a phone, sessions survive browser close, wifi loss, and a
runner restart, no GitHub token or vendor credential is stored by the
control plane, two sessions run two Codex accounts at once, and
`docker compose up` brings the control plane up on a fresh machine.

## Open questions

1. Is a second agent in the chip (Claude Code) cheap enough to include
   from the start, given note 06 says the mechanism is identical, or
   does it stay strictly next?
2. Tabs: multiple terminals per session in the MVP, or one terminal
   and tmux windows inside it?
3. Ephemeral default idle timeout: two hours as written, or shorter for
   cloud later?
4. Does the MVP need Clean VM at all, or is Shared workspace enough
   for the first month? Clean VM costs a second boot path and a second
   image role.
