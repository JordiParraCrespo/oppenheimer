---
"@oppenheimer/shared": minor
"@oppenheimer/api-client": patch
"@oppenheimer/frontend-consumer": minor
---

`POST /sessions` takes exactly one checkout. A session with none was accepted,
then refused by the runner at launch, which makes a session as one worktree of
one repository; it is now refused with a 400 before a row is written.
`CreateSessionInput.checkouts` is a one-element tuple to match.
