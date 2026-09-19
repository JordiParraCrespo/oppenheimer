---
"@oppenheimer/api": minor
---

Sessions, their checkouts and the append-only log the session row is a fold of,
behind eleven routes over three tables.

`DELETE /projects/{id}` archives a project and lands here too: it asks the module
that owns sessions whether any work is still open, through a port that module
registers, and refuses when nothing answers. Naming a session from its first prompt
is optional configuration — with no provider set, a session keeps its slug.
