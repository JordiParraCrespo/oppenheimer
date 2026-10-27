# Cloud agents

**Goal:** start and follow sessions that run in the vendors' clouds
(Claude Code's `claude --cloud`, Codex cloud, Cursor's Cloud Agents) from
the console, next to sessions on hosts. A session can also be brought
back onto a host as an ordinary terminal session. The owner raised this
on 2026-10-22, and it has no version yet.

The proposal is [`../research/cloud-agents.md`](../research/cloud-agents.md)
§5, and its open questions are §6. This file keeps only what decides
whether it lands, and in which version. In short, the remote features for
host sessions come first, then a Cloud place: Cursor first, then Claude,
then Codex.

## What landed (2026-10-26)

The owner asked for Cursor's cloud first, end to end and thin, ahead of a
version: a rail item, **Cloud agents**, beside Sessions.

- **Who calls the vendor.** The control plane, on the person's own Cursor
  API key (Settings → Cloud agents). The key is checked with Cursor
  (`GET /v1/me`) before it is stored, sealed under `CLOUD_AGENTS_KEY`, one
  per person, workspace and vendor, never returned and never sent to a
  host. It bills the person's own Cursor plan. Grok runs here as one of
  Cursor's models (Cursor lists `grok-4.7`); xAI's own API has no cloud
  agent to launch.
- **What it is.** Its own module and table (`apps/api/src/cloud-agents/`,
  `cloud_agent`), not a third place of `work_session`: a work session is
  the fold of a host's event log, with a host, a tmux session and
  checkouts, none of which a vendor's agent has. Note 24 stays as it is.
  A cloud agent is a person's own: nobody else in the workspace reads it.
- **What it shows.** Launch (a prompt, a repository Cursor can reach, a
  model or Cursor's own pick, a starting branch, open a pull request);
  the run's status, pushed branch, pull request and last reply; Stop; a
  next instruction as a new run; Open in Cursor. No chat stream yet: the
  run is read (`GET /v1/agents/{id}/runs/{runId}`), not streamed.
- **Only what we launched** is listed; agents started from Cursor's web
  page, Slack or Linear are not imported.
- **The budget.** Cursor counts about 20 calls a minute per person. An
  open agent is read at most once in ten seconds, a list asks about at
  most three working agents once in thirty, models are cached an hour and
  repositories ten minutes (Cursor allows one listing a minute). Every
  call goes through one `UpstreamLimiter` bucketed by the Cursor user; a
  rate limit is `CLOUD_AGENTS_007`, and a read never fails on it.
- **The provider shape.** `CloudAgentProvider` with Cursor the one
  provider in its registry. The person picks the vendor, so there is no
  fallback walk: an agent lives at the vendor it was launched on.

What the first real call proved, on the owner's key (2026-10-26): the key
is accepted and names its account, models and repositories list, a wrong
key is `CLOUD_AGENTS_005` in Cursor's words. A launch reached Cursor and
was refused for the account's prepaid balance (`usage_limit_exceeded`,
shown as `CLOUD_AGENTS_010` with Cursor's sentence), so a run on Cursor's
side is proven against the stub only (`e2e/support/cursor-stub.ts`).

## Questions to answer first

1. ~~Does the control plane holding a person's Cursor API key need F23
   reworded to "no subscription sign-in"?~~ Answered 2026-10-26: F23
   carries a dated line saying so (`../04-security-review.md`).
2. Which version takes it, and does the first step (remote features for
   host sessions) go into 0.7 with the chat? Cursor landed ahead of any
   version; Claude and Codex still wait on this.
3. ~~Do cloud sessions started elsewhere show up in our list?~~ Answered
   2026-10-26: only the ones we launched.
4. ~~Does Cloud as a third place hold?~~ Answered 2026-10-26 for now: a
   session with no terminal has a model of its own (`cloud_agent`). Claude
   `--cloud` and teleport, which a host dispatches, may still want the
   place; that is decided when they are built.
5. A chat for a cloud agent: Cursor streams a run (`…/runs/{runId}/stream`,
   SSE) in shapes close to the 0.7 chat's entries. Does the console stream
   it through the API, and does the run's transcript get kept?
6. "Bring it here": a worktree session on a host, on the agent's
   `cursor/…` branch. It needs the agent's repository to be one of the
   workspace's projects.
