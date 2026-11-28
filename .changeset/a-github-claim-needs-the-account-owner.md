---
'@oppenheimer/api': patch
'@oppenheimer/shared': patch
---

Connecting a GitHub App installation now proves the authorizing person
controls the installation's account, not only that GitHub lists it for them
(GitHub lists an installation for anyone with access to one repository it
covers).

- `@oppenheimer/api`: a personal installation connects only for that same
  GitHub account, an organization's only for an active owner of it
  (`GET /user/memberships/orgs/{org}`, role `admin`), on a new connect, a
  refresh and a reconnect alike; anything else is `GITHUB_004` with a
  `detail` saying why. The organization check needs the App's Members: read
  organization permission; without it organization connects are refused.
- `@oppenheimer/shared`: the bundled guide says who can connect an
  installation and what the Members permission is for.
