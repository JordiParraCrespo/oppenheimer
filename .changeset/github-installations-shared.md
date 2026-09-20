---
"@oppenheimer/shared": minor
---

Add `github_app` to `DEPLOYMENT_CAPABILITIES` and to the `CLIENT_CAPABILITIES` wire subset, so a console can tell "you have not connected GitHub yet" from "this deployment has no GitHub App, and Connect will refuse". It is on when all six `GITHUB_APP_*` settings are present, the App slug included, because that slug is what the install link is built from.
