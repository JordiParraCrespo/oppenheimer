# Multi-account

**Goal:** several agent accounts per person, several Claude or Codex
logins for example, each used by the sessions that pick it. On the
roadmap as of 2026-09-26, with no version number yet.

## What exists to build on

- `../../archive/multi-account.md` designs it end to end. It covers how Orca handles several
  Claude, Codex, Kimi and OpenCode accounts and their usage meters, one
  config directory per account on the host, and one volume per account
  once VMs exist (`../../archive/security-review.md`). It also covers the macOS Keychain, which
  Claude Code 2.1.144+ scopes per config dir, so it is not a blocker.
- The MVP left accounts out on purpose ("no account objects",
  `../../decisions.md`). `../../decisions.md` notes that `../../archive/multi-account.md`'s
  per-account config directories stay the answer for several logins on
  one machine.
- Since 2026-10-28 each host reports the claude.ai account its `claude` is
  signed in as, shown in Settings → Hosts and in New session's Start from
  pane (`session-places.md`, decided list). Choosing an
  account is choosing a host until this lands.
- The agent catalog (`CODING_AGENTS`) and the launch options stored on
  `work_session` (`../foundations/api-modules-and-data-model.md`).

## Questions to answer first

1. Which version does it ship in? It touches New session (an account
   chip), the runner (a config dir per account) and the data model (an
   account table).
2. Are usage meters and headroom routing, which pick the account with
   quota left, part of it or a later step?
3. Is an account the person's, like a host, or the workspace's?
4. Where are credentials held: only on the host, or the control plane
   too?
