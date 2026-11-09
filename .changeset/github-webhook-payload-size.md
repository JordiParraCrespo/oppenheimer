---
"@oppenheimer/api": patch
"@oppenheimer/backend-core": patch
---

GitHub webhook deliveries over 100 kB are accepted again: the webhook reads its body raw, up to GitHub's own 25 MB cap, and anything larger gets a 413. A client error that body-parser raises (413, 415, an aborted body) now keeps its status instead of turning into a 500 and an error report.
