---
"@oppenheimer/api": patch
"@oppenheimer/shared": patch
"@oppenheimer/api-client": patch
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/web": patch
"@oppenheimer/translations": patch
---

The GitHub App install callback is bound to the person who started it.

- `@oppenheimer/api`: `POST /v1/installations/install-state` (`startInstallation`)
  mints a single-use, 15-minute state bound to the caller and the workspace and
  answers the App's install URL carrying it. `POST /v1/installations` requires
  that state and spends it before GitHub is called; anything else is
  `GITHUB_011`, one code for missing, expired, reused and someone else's.
- `@oppenheimer/shared`: `connectInstallationSchema` requires `state`
  (`installStateSchema`).
- `@oppenheimer/api-client`: regenerated.
- `@oppenheimer/frontend-consumer`: `useStartInstallation`, and
  `InstallationsService.connect` takes `{ githubInstallationId, code, state }`.
- `@oppenheimer/web`: Connect GitHub and New session's Manage repository access
  mint the state on click; a callback without one is refused on screen and
  never posted. The first-run walk rides as the state's prefix.
- `@oppenheimer/translations`: `errors.byCode.GITHUB_011`,
  `onboarding.flow.github.unstarted`, `onboarding.flow.github.starting`,
  `sessions.new.repository.manageFailed`.
