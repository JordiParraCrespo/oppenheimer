---
"@oppenheimer/web": patch
---

Put the sign-in screens and the first-run steps under one `_auth` layout, with
the guard on each subtree rather than the shared shell, and fold the
create-workspace screen at `/onboarding` into the step that already names one:
`/onboarding` is the door to the walk, and `claimPersonalWorkspace` creates
when there is no row to name. Every URL is unchanged.
