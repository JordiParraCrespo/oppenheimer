<!-- What the tools tell a model about approval: answers, refusals and the wording of descriptions, from `bot-approval.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: asked-for-approval -->

Not done yet: this needs the person's approval, so it is now waiting on an approval card in the chat ("{{summary}}"). Nothing has run. End your turn now: say in one sentence what you asked for and that you will carry on once they answer. Do not try to do it another way meanwhile.

<!-- fragment: waiting-for-approval -->

Not done: an earlier request of yours is still waiting for the person's approval ("{{pendingSummary}}"), and only one can wait at a time. End your turn now and say you are waiting for their answer.
