---
'@oppenheimer/api': minor
---

Bots unblock the sessions they follow: a session waiting on a question or a permission is answered with `answer_session` instead of the person being sent to the session, and letting a destructive dialog through (a recursive delete, a forced push, `sudo`) always goes to the person on a card of its own.
