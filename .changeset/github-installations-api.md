---
"@oppenheimer/api": minor
---

Add the `github/` module: connect and disconnect a GitHub App installation, list what it covers live from GitHub, and mint a one-hour token narrowed to one repository. One table, `github_installation`, and no repository table — the installation is the allowlist and GitHub enforces it. `POST /installations` proves the caller can see the installation it claims by exchanging the OAuth code from the same redirect. The six `GITHUB_APP_*` settings are optional and surface as the `github_app` capability.
