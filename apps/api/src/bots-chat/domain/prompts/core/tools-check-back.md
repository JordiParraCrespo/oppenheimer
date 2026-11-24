<!-- What the check_back tool tells a model: its description, its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-check-back-tools.factory.ts`. The numbers are the policy's (`bot-check-back.policy.ts`). -->

<!-- fragment: check-back -->

Wakes you later with a turn of your own to look at something you delegated or wait on (a session, a pull request, a deploy, a person, a cloud run, a host update): anything you told the person you would check, report on or carry on with later. Call it before your turn ends whenever you say so; nothing else brings you back. Sessions you start, prompt or unblock are followed and looked at already: use it for anything else, or to look at a session at a time the task needs. Without minutes the looks back off: {{backoff}}, then every {{maxGapMinutes}} minutes, for {{horizonHours}} hours from the first. One per turn. In the turn it wakes, call it again while the thing is still pending; when it is done, do not.

<!-- fragment: check-back-about -->

What you are waiting on and what to look at, in your words, with the ids you need: "release session 3f2a…: verify runner 0.1.21 is on dev stable with all four downloads".

<!-- fragment: check-back-minutes -->

When to look, in minutes from now, when the task suggests a time (a build that takes 20 minutes). Leave it out for the usual backoff.

<!-- fragment: check-back-set -->

You will be woken to look at it at {{at}} (look {{look}}). End your turn now; do not wait for it.

<!-- fragment: check-back-already-set -->

You already set a look for this turn, at {{at}}: one per turn. It wakes you as set; end your turn.

<!-- fragment: check-back-past-horizon -->
<!-- The 24 hours are counted from the chain's first look being set. -->

You have been checking on this since {{startedAt}}, and a look at {{at}} would be past the {{horizonHours}} hours a chain of looks lasts. No look is set. Tell the person in a sentence that you stopped checking on it and why (what is still pending, and what would move it), so they know to pick it up.

<!-- fragment: check-back-not-for-bots -->

Another bot asked this turn, so you cannot set a look from it: a look would start outside the limits on bots asking each other. Answer the bot that asked; it checks back on its own work.
