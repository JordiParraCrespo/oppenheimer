---
"@oppenheimer/web": patch
---

Put the sign-in screens and the onboarding flow under one `_auth` layout, with
the guard on each subtree instead of the shared shell. The recovery screen at
`/onboarding` renders in that layout too, rather than its own page chrome.
Every URL is unchanged.
