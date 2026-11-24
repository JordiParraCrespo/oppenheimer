<!-- What the goal tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-goal-tools.factory.ts`, `bot-goal.mapper.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: set-goal -->

Sets a goal you keep working toward across turns, for work that takes several steps on your own: "get the release branch green", "triage every open issue labelled bug". Write it as a condition with the check that proves it ("pnpm test exits 0 on the release branch"). After each of your turns another comes, with no limit, until you call end_goal with outcome met and a reviewer agrees from what you showed; the person sees each one and can stop it. It pauses after {{goalIdleTurns}} turns in a row that call no tool, and when a turn fails. One goal at a time: setting one replaces the last. Not for a task one turn finishes, and not for waiting on a session (watch it instead).

<!-- fragment: set-goal-objective -->

What done looks like, and how to check it, in words the person can read.

<!-- fragment: set-goal-token-budget -->

The most tokens its turns may spend, input and output, before it pauses. Only when the person names a budget; none by default.

<!-- fragment: end-goal -->

Says your goal is done or stuck. outcome met: you ran its check and it holds; when this turn ends a reviewer reads what you showed and ends the goal, or sends you on with its reason. outcome blocked: it cannot go on without the person; it pauses until they resume it. Say why in reason and in your reply. Outside the goal's own turns (the person asked you to stop it), met ends it at once.

<!-- fragment: end-goal-reason -->

For met, the check you ran and what it answered; for blocked, what you need.

<!-- fragment: end-goal-goal-changed-meanwhile -->

Your goal changed meanwhile (it was paused, ended or replaced); nothing was done.

<!-- fragment: end-goal-goal-paused-blocked -->

Goal paused as blocked: {{objective}}. It stays open until the person resumes it.

<!-- fragment: end-goal-goal-ended-after -->

Goal ended after {{continuations}} continuations: {{objective}}

<!-- fragment: end-goal-goal-paused-person -->

Your goal is paused; the person resumes it. Say in your reply what you found.

<!-- fragment: end-goal-noted-when-turn -->

Noted. When this turn ends a reviewer reads what you showed: the goal ends if it holds, otherwise your next turn says why not. Finish the turn by reporting the check and its result.

<!-- fragment: to-set-answer-pauses-once-turns -->

It pauses once its turns spend {{tokenBudget}} tokens.

<!-- fragment: to-set-answer-goal-set-after -->

Goal set: {{objective}}.{{before}} After each of your turns another comes, for as long as the goal is open.{{budget}} When it is met, show its check and call end_goal with outcome met: a reviewer reads your turn and ends it, or sends you on. If it cannot go on without the person, call end_goal with outcome blocked.
