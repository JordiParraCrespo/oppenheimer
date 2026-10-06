---
"@oppenheimer/api": patch
---

The PR queue and its analytics read GitHub within a budget: the figures and the
day chart come from the listings and are whole on the first read, and the parts
a pull request needs for its lane, its checks and its reviews are filled as far
as the budget allows, deepening over the reads that follow. A part refused with
"slow down" is kept for minutes rather than fifteen seconds, and a closed pull
request's checks — which nothing reads — are no longer fetched.
