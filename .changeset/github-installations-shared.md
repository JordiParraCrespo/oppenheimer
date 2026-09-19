---
"@oppenheimer/shared": minor
---

Add `github_app` to `DEPLOYMENT_CAPABILITIES`, so a deployment can report whether the sessions GitHub App is configured. It stays off the client wire subset: an empty installation list is what a console reads as "connect GitHub".
