---
"@oppenheimer/api": patch
"@oppenheimer/web": patch
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/api-client": patch
"@oppenheimer/translations": patch
---

Pull requests read GitHub under its limits and survive a refused part. Each token keeps at most four requests in flight and waits out `Retry-After` and a spent budget, and a long wait is `GITHUB_015` instead of `GITHUB_009` (#247). Analytics reads at most the 150 most recently closed pull requests and says so when there were more. A pull request whose checks GitHub refuses keeps its row with "Checks unavailable", a repository GitHub will not answer is named instead of failing the queue, and a refused permission says what to grant (#244).
