# Cloud agents

**Goal:** start and follow sessions that run in the vendors' clouds
(Claude Code's `claude --cloud`, Codex cloud, Cursor's Cloud Agents) from
the console, next to sessions on hosts. A session can also be brought
back onto a host as an ordinary terminal session. The owner raised this
on 2026-10-22, and it has no version yet.

**Claude is built** (2026-10-27), ahead of the order below, because the
owner asked for it end to end:

- **Cloud is a third place** (`../versions/mvp/24-session-places.md` §7). New
  session's Where chip offers *Claude Code cloud* on a host.
- **The dispatching host's runner starts it.** It fetches the repository with
  a token sealed into the create, runs `claude --cloud <task>` in a scratch
  checkout of the base (the CLI insists on a terminal, so it gets a
  pseudo-terminal), reports the cloud session's id on `session.started` and
  removes the checkout. Nothing is left on the host and nothing is polled.
- **Status comes from the browser.** `apps/extension` reads the person's
  cloud sessions on claude.ai with the sign-in already in their Chrome, and,
  once connected with a personal token pinned to the workspace, posts what it
  sees to `POST /sessions/cloud-status`. The API keeps it for the sessions the
  workspace launched, as the agent's observed state, so their dots follow the
  usual rules. No claude.ai credential ever leaves the browser.
- **Bring it here** is the command, `claude --teleport <id>`, on the
  session's pane. A Teleport button that opens a worktree session on a host
  is not built.

The proposal is [`../research/cloud-agents.md`](../research/cloud-agents.md)
§5, and its open questions are §6. This file keeps only what decides
whether it lands, and in which version. In short, the remote features for
host sessions come first, then a Cloud place: Cursor first, then Claude,
then Codex.

## Questions to answer first

1. Does the control plane holding a person's Cursor API key need F23
   reworded to "no subscription sign-in"? The bots' sealed keys already
   hold API keys.
2. Which version takes it, and does the first step (remote features for
   host sessions) go into 0.7 with the chat?
3. Do cloud sessions started elsewhere (Slack, Linear, GitHub, the
   vendor's web) show up in our list, or only the ones we launched?
4. Does Cloud as a third place (`../versions/mvp/24-session-places.md`)
   hold, or does a session with no terminal want a model of its own?
