<!-- What the loop tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-loop-tools.factory.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: schedule-loop -->

Sets when your self-paced loop (set with /loop and no interval) runs next: 1 to {{loopSelfPacedMaxMinutes}} minutes from now. Sooner while what you watch is changing, later when it is quiet. Call it once per run; if a run does not call it, the loop ends. A loop on a fixed interval keeps its own time.

<!-- fragment: schedule-loop-minutes -->

How many minutes from now the next run is due.

<!-- fragment: schedule-loop-have-loop-schedule -->

You have no loop to schedule.

<!-- fragment: schedule-loop-loop-runs-every -->

Your loop runs every {{intervalMinutes}} minutes on its own; there is nothing to schedule.

<!-- fragment: schedule-loop-loop-ended-moved -->

Your loop ended or moved on before it could be scheduled.

<!-- fragment: end-loop -->

Ends your loop (set with /loop): it has served its purpose, what it watches finished, or it cannot go on without the person. No more runs come. Say why in your reply.
