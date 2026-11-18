<!-- What the tools tell a model about web: answers, refusals and the wording of descriptions, from `web-address.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: refuse-url-only-http-https -->

Only http and https pages can be fetched, not {{protocol}}

<!-- fragment: refuse-url-url-user-name -->

A URL with a user name or password is refused.

<!-- fragment: refuse-url-address-public-internet -->

That address is not on the public internet.
