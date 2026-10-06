---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

An organization's repositories can be reached from the project dialog, and a
requested organization install is said rather than dropped.

- `@oppenheimer/design-system-web`: `RepositoryAddField` takes an `action`, the
  pinned foot row `ChipSelect` already has.
- `@oppenheimer/frontend-consumer`: `useManageGithubAccess(openTab)` (moved
  from the console's sessions feature) mints the install state and points the
  platform's tab at it; when the reader comes back it drops the installations
  and their repositories, which the other tab connected.
- `@oppenheimer/frontend-web`: `openPendingTab` in `platform`, the tab opened
  in the click (so popup blockers allow it) with an `onReturn` on refocus.
- `@oppenheimer/web`: New project's repositories pane ends in **Manage
  repository access**; `/onboarding/github` explains a `setup_action=request`
  return (an organization owner has to approve) instead of showing nothing.
- `@oppenheimer/translations`: `projects.dialog.manage`, `…manageFailed`,
  `onboarding.flow.github.requested`; Connect GitHub's description names
  organizations.
