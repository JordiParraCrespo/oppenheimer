---
name: ketchup
description: Catch the user up in plain words and small visuals, and list every call waiting on them so they can make it from the reply alone. `/ketchup` covers this chat since their last message; `/ketchup all` covers every open agent pull request in the repository, by its merge label. Read-only. Use for /ketchup.
disable-model-invocation: true
argument-hint: "[all]"
---

# Ketchup

Adapted from poteto's `ketchup` in pstack (`cursor/plugins`, MIT).

Catch the user up, and help them understand each change, not only where it
stands. Then lay out every call waiting on them so they can make it from your
reply alone. Write in the `bro` voice.

## Scope

- **`/ketchup`**: this chat, since the last message the user wrote.
  Notifications and subagent results are not their messages. Assume they
  remember their last message and nothing after it.
- **`/ketchup all`**: every open pull request an agent opened in this
  repository, read from GitHub by its label (the protocol is `steward`,
  "Merging"). `propose` pull requests wait on them. A `ship` or `research`
  pull request that is not merging is stuck: say why, from its threads,
  its report and its mergeability. Add what merged since the last
  `/ketchup all` in this chat, or in the last day, one line each.

## Gather

Keep this turn read-only: change no code, start no app or job, post
nothing. Check the current state of each pull request, report or agent
you will mention, and each number you will show against where it comes
from; say so when you correct one.

An **action item** is a call only the user can make: a product choice, an
approval (`/ship` on a `propose` pull request), something that cannot be
undone, access you lack. Include any still waiting on them, even one raised
before their last message. Work you can still do yourself is not an action
item, and never make one up to fill the reply.

For each item collect its link, what it changes for users, the evidence
behind your pick (the verifier's verdict, the autoreview, the screenshots),
its risk, and your pick. Write "unknown" for a fact the call needs that
you do not have.

## Write

Spend the words on the calls, not the story.

1. **One sentence** naming what waits on them, or saying nothing does. If
   nothing happened and nothing waits, say so and stop.
2. **What happened**, pictures first: the screenshots the work produced,
   then any diagram from the `visualize` skill that explains a change.
   Then one short bullet per thing they asked for (per pull request for
   `all`): what came of it, and whether it is done, running, failed or
   not checked, said the way you would say it out loud. Under 100 words
   for this part, fewer when less happened. Never mark something done
   that still waits on them.
3. **The action items.** One call about one item is one bullet: the call,
   your pick, what it changes for users, the evidence, the risk (even
   "Low risk: only the colors change"). When items share a call ("accept
   these three proposals"), write the call and pick once, then a bullet per
   item, riskiest first. About 30 words per item; never cut an item or
   replace a list with a count to save words. A call between options gives
   each option with what it gets them and what it costs.

Name each pull request by its number and a name they would recognise. Link
only things that exist.
