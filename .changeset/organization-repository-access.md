---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

An organization's repositories can be reached from the project dialog, and a
requested organization install is said rather than dropped.

- `@oppenheimer/design-system-web`: `RepositoryAddField` takes an `action`, the
  pinned foot row `ChipSelect` already has.
- `@oppenheimer/frontend-consumer`: `useManageGithubAccess` (moved from the
  console's sessions feature) opens the App's install page in a new tab with a
  minted state, for any picker that offers it.
- `@oppenheimer/web`: New project's repositories pane ends in **Manage
  repository access**; `/onboarding/github` explains a `setup_action=request`
  return (an organization owner has to approve) instead of showing nothing.
- `@oppenheimer/translations`: `projects.dialog.manage`, `…manageFailed`,
  `onboarding.flow.github.requested`; Connect GitHub's description names
  organizations.
