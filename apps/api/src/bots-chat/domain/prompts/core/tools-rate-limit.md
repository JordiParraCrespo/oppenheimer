<!-- What the tools tell a model about rate limit: answers, refusals and the wording of descriptions, from `bot-rate-limit.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: rate-limited-line -->

{{code}}: {{system}} is limiting our requests {{until}}, and stopped this call there. {{waitAdvice}}

<!-- fragment: rate-limited-partway-line -->

{{system}} began limiting our requests {{until}}, so {{notReached}} more were not reached; the ones above did change. {{waitAdvice}}

<!-- fragment: wait-advice -->

A limit is normal when working through a lot and passes on its own; calling {{system}} again before then only meets it again. Do not retry it in this turn: say what is done, what is left, and that it can go on after then. A goal's next turn waits for it on its own.
