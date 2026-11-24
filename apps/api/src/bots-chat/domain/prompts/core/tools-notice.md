<!-- What the tools tell a model about notice: answers, refusals and the wording of descriptions, from `bot-notice.policy.ts`, `bot-routine.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: notice-sent -->

Sent: your line is in the person's Inbox, in place of any earlier notice of yours. Do not repeat it in this turn.

<!-- fragment: notices-spent -->

Not sent: you have already sent {{noticesPerTurn}} notices this turn, the most one turn may send. Your last one stands.

<!-- fragment: quiet-turn-answer -->

Noted: nothing to report. End your turn now without writing anything: what you write after this is not kept.

<!-- fragment: nothing-to-report-checked -->

What you looked at, in a few words (open PRs, new mail); the chat shows it.

<!-- fragment: notify-text -->

One line for the person: what is done, or what you need from them.

<!-- fragment: notify -->

Puts one line in the person's Inbox, where they see it whether or not they are in this chat. Use it when they may not be in your chat (a routine's run, a wake, a long task). {{worthSaying}} Follow what they told you about when and what to hear. One line, at most {{noticeTextMax}} characters: what is done or what you need, not a report. The Inbox keeps one line per bot, so a new notice replaces your last one; at most {{noticesPerTurn}} a turn; not for what you are already saying to them in the chat.

<!-- fragment: quiet-tool -->

Ends a turn nobody is waiting on (a routine such as your heartbeat, a wake, a goal) quietly: nothing in the chat but this line, nothing in the Inbox. Use it when you checked and nothing needs you or the person; then write nothing, since what you write after it is not kept. Not when you did something or found something they should know: say that instead, briefly.
