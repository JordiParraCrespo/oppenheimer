---
"@oppenheimer/api": patch
---

A goal no longer stops when one of its turns reaches the 4-minute limit for
one turn (`product/versions/mvp/25-bots.md` §4.1). That turn is reviewed like
one that completed, and the next continuation picks its work up on a fresh
clock, told its last turn ran out of time and to take a smaller step. Any
other failure, and a person's Stop, still stop the goal.
