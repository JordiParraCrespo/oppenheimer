# @oppenheimer/tsconfig

## 0.2.0

### Minor Changes

- f099524: `@oppenheimer/config` is now `@oppenheimer/tsconfig`, named after what it holds: tsconfig presets and the two build-time helpers that travel with them.

### Patch Changes

- a66c1fe: - `@oppenheimer/frontend-web`: the `hosts` concern is `pairing`, and its components are `PairingChrome`, `PairingToken`, `PairingStatus`, `PairingCopyButtons` and `PairingInstruction`; `AppPending` and `SessionRestoreError` are added.
  - `@oppenheimer/tsconfig`: the app dependency-cruiser rules add `providers-mount-dialogs` and `features-query-through-the-product`.
  - `@oppenheimer/web`: `features/installations/`.
- a0e23bd: Search params are Zod schemas (`searchText`, `searchFlag`, `searchPage`) and nuqs is removed; the `one-api-client` rule and the removed `sessions.agents` keys ride along.
