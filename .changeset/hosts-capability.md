---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-core": patch
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

The console learns that hosts are off before it mints, not by failing.

- `@oppenheimer/api`: `GET /health/capabilities` reports `hosts`, from the
  same resolution the boot log prints.
- `@oppenheimer/shared`: `hosts` joins `CLIENT_CAPABILITIES`.
- `@oppenheimer/api-client`: regenerated.
- `@oppenheimer/frontend-core`: `useDeploymentCapabilities` documents `hosts`.
- `@oppenheimer/translations`: `hosts.pairing.unavailable`.
- `@oppenheimer/web`: onboarding's host step, the Add a host dialog and
  Settings' Add a host page mint no token on a deployment that cannot pair;
  they say why, and onboarding makes Skip the primary action.
