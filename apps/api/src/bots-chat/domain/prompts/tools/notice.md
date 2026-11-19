<!-- What the tools tell a model about notice: answers, refusals and the wording of descriptions, from `bot-notice.policy.ts`, `bot-routine.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: notice-sent -->

Sent: your line is in the person's Inbox, in place of any earlier notice of yours. Do not repeat it in this turn.

<!-- fragment: notices-spent -->

Not sent: you have already sent {{noticesPerTurn}} notices this turn, the most one turn may send. Your last one stands.

<!-- fragment: quiet-turn-answer -->

Noted: nothing to report. End your turn now without writing anything: what you write after this is not kept.
