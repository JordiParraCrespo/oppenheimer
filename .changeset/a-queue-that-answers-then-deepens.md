---
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/api": patch
---

The PR queue answers with its rows and fills their parts over the polls that
follow, instead of making the reader wait for every part of every row. What one
read fills is five pull requests; the answer says whether it is still filling,
and the console asks again while it is.
