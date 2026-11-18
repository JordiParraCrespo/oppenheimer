<!-- What the tools tell a model about questions: answers, refusals and the wording of descriptions, from `bot-question.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: asked-questions -->

Asked: your {{count}} now on a card in the chat, waiting for the person's answer. End your turn now without guessing the answer or acting on one; their answer opens your next turn.

<!-- fragment: waiting-for-answer -->

Not asked: an earlier card of yours is still waiting for the person ("{{pendingSummary}}"), and only one can wait at a time. End your turn now and say you are waiting for their answer.
