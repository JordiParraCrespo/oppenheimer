<!-- A goal (`/goal`): what a continuation tells the bot (the goal, which continuation it is, the reviewer's reason when it found a claim not met yet, its budget, how to end it, and, when its last turn stopped without fault, that its work is kept), then the lines about its pause, its resumption and its end, outside any turn: the person sees them and the bot reads them in its history. The turn the person's /goal opens is `turn/slash-command.md`. -->

<!-- fragment: continue -->

Continue toward your goal ({{count}}): {{objective}}

<!-- fragment: continuation -->
<!-- A goal's count in words. The two with "of" are for a goal set with a limit before 2026-11-09. -->

continuation {{step}}

<!-- fragment: continuation-of -->

continuation {{step}} of {{limit}}

<!-- fragment: continuations -->

{{step}} continuations

<!-- fragment: continuations-of -->

{{step}} of {{limit}} continuations

<!-- fragment: last-turn-stopped -->

Your last turn stopped before it finished (its model went silent, the server restarted, or the model provider's limit stopped it and has since passed); what it did is kept. Check the state of anything it left in progress before repeating it.

<!-- fragment: not-met-yet -->

You said the goal is met, and a reviewer read your turn: it is not met yet. {{reason}}

<!-- fragment: nobody-wrote -->

Nobody wrote to you: this turn exists to make progress on the goal.

<!-- fragment: budget -->

Budget: {{used}} of {{budget}} tokens spent. The goal pauses when it is spent.

<!-- fragment: take-the-next-step -->

Read what your last turns did, take the next step, and say what it showed. A turn that calls no tool is not progress: after {{idleTurns}} of them in a row the goal pauses.

<!-- fragment: how-it-ends -->

When the goal is met, run its check, say what it answered and call end_goal with outcome met. When it cannot go on without the person, call end_goal with outcome blocked and say what you need.

<!-- fragment: pause-line -->

{{paused}}: {{objective}}

<!-- fragment: paused -->

Your goal is paused

<!-- fragment: paused-blocked -->

Your goal is paused: it cannot go on without the person

<!-- fragment: paused-usage-limit -->

Your goal is paused: the model provider refused for a limit, quota or sign-in

<!-- fragment: paused-no-progress -->

Your goal is paused: {{idleTurns}} of its turns in a row called no tool

<!-- fragment: paused-budget -->

Your goal is paused: it spent its token budget

<!-- fragment: paused-stopped -->

Your goal is paused: the person stopped a turn of it

<!-- fragment: paused-failed -->

Your goal is paused: a turn of it failed

<!-- fragment: why -->

Why: {{note}}

<!-- fragment: stays-open -->

It stays open; the person resumes it.

<!-- fragment: resumed -->

The person resumed your goal: {{objective}}

<!-- fragment: end-line -->

{{ended}} ({{count}}): {{objective}}

<!-- fragment: ended-met -->

A reviewer found your goal met

<!-- fragment: ended-impossible -->

A reviewer found your goal cannot be met without the person

<!-- fragment: ended-cleared -->

The person stopped your goal

<!-- fragment: ended-exhausted -->

Your goal used all its continuations and stopped

<!-- fragment: ended-stopped -->

Your goal stopped because its owner can no longer act in the workspace

<!-- fragment: reason -->

Reason: {{reason}}
