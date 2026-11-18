<!-- What the tools tell a model about web: answers, refusals and the wording of descriptions, from `web-address.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: refused-not-http -->

Only http and https pages can be fetched, not {{protocol}}

<!-- fragment: refused-has-credentials -->

A URL with a user name or password is refused.

<!-- fragment: refused-not-public -->

That address is not on the public internet.
