<!-- What the tools tell a model about questions: answers, refusals and the wording of descriptions, from `bot-question.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: asked-questions -->

Asked: your {{count}} now on a card in the chat, waiting for the person's answer. End your turn now without guessing the answer or acting on one; their answer opens your next turn.

<!-- fragment: waiting-for-answer -->

Not asked: an earlier card of yours is still waiting for the person ("{{pendingSummary}}"), and only one can wait at a time. End your turn now and say you are waiting for their answer.

<!-- fragment: ask-user-questions-header -->

A tag of a word or two over the question ("Scope", "Deadline").

<!-- fragment: ask-user-questions-question -->

The question, ending in "?".

<!-- fragment: ask-user-questions-multi-select -->

True when several options may be picked; one otherwise.

<!-- fragment: ask-user-questions-options-what-picking-means -->

What picking it means, when the label does not say.

<!-- fragment: ask-user-questions-options-likely-answers-person -->

The likely answers. The person may always answer in their own words instead.

<!-- fragment: ask-user -->

Asks the person up to {{questionsMax}} questions on a card in the chat, each with {{questionOptionsMin}} to {{questionOptionsMax}} likely answers, and ends your turn; their answers open your next one. Use it when you cannot go on without a choice only they can make (which of two repositories, a deadline, what to leave out), rather than guessing. Do not use it for a yes to an action: the actions that need one ask on their own. One card waits at a time.
