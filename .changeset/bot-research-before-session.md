---
'@oppenheimer/api': patch
---

A bot researches before it starts a session. Its prompt and `start_session`'s
description now say to answer from its own tools, web search and `web_fetch`
when they can, and to start a session only for work that needs a shell or a
checkout (changing code, running tests, reproducing a failure) or when the
person asks for one.
