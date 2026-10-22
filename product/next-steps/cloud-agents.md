# Cloud agents

**Goal:** start and follow sessions that run in the vendors' clouds
(Claude Code's `claude --cloud`, Codex cloud, Cursor's Cloud Agents) from
the console, next to sessions on hosts, and bring one back onto a host as
an ordinary terminal session. The owner raised it on 2026-10-22; it has
no version yet.

## What exists to build on

- `../research/cloud-agents.md`, which covers what each vendor exposes as
  of 2026-10-22 and a proposal (§5). In brief:
  - Cursor has a public API (agents, runs, SSE, webhooks on v0).
  - Claude Code and Codex can only be driven through their CLIs, signed
    in on a host. Anthropic's terms forbid a third party holding a
    claude.ai sign-in.
- Session places (`../versions/mvp/24-session-places.md`): a fourth
  place, **Cloud**, beside New worktree, Folder on host and Blank
  terminal.
- The runner and its per-host logins (note 01 §7, F23), which can run
  `claude --cloud`, `claude --teleport`, `codex cloud exec` and
  `codex apply` the way a person would.
- The 0.7 chat (`0.7-terminal-and-chat.md`), the display for a session
  with no terminal. Cursor's run stream maps onto its entries.
- The 0.2 Pull requests area, which follows a branch to its PR. For
  Claude and Codex cloud sessions this is where "done" comes from.
- The bots' sealed workspace keys (`../versions/mvp/25-bots.md`), the
  precedent for holding a Cursor API key in the control plane.

## Proposed order

1. **Remote features for host sessions**, which need no new place:
   - a Codex transcript reader and hooks;
   - Codex run through `codex app-server` behind its TUI (a spike);
   - a "reachable from the vendor's app" launch option (`--rc`);
   - Cursor's `agent` CLI as an engine.
2. **Cursor cloud**: the Cloud place, launched by the control plane with
   the person's API key, followed over SSE into the chat.
3. **Claude cloud**: `--cloud` through a dispatching host, and teleport
   into a worktree session.
4. **Codex cloud**: `codex cloud exec` through a dispatching host, and
   `codex apply` into a worktree session.

## Questions to answer first

1. Does the Cursor key held by the control plane need F23 reworded?
   That is: "no subscription sign-in", where API keys are what the bots
   already hold.
2. Which version takes it, and does step 1 go into 0.7 with the chat?
3. Do cloud sessions started elsewhere (Slack, Linear, GitHub, the
   vendor's web) show up in our list, or only the ones we launched?
4. The rest are `../research/cloud-agents.md` §6.
