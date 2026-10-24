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
