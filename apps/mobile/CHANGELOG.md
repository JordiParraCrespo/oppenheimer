# @oppenheimer/mobile

## 0.2.0

### Minor Changes

- f099524: Sign in with the same screens as the web apps.
- 1a51afc: Port the rn-bedrock stack: Expo SDK 57 with a dev client, nitro-fetch, MMKV, optional Sentry and RevenueCat keys, the gorhom sheet forks, Legend List, expo-image and nano-icons.

### Patch Changes

- 9ae654e: Mount the root navigator before the authentication guards, so the app starts without Expo Router throwing an early-navigation error, and refresh the login screen onto the shared auth layout.
- f099524: Auth screens run through React Hook Form: per-field errors inline, instead of the first Zod failure in an `Alert`.
- f099524: Load the root `.env` before Metro bundles, and read the deep-link `scheme` from `MOBILE_SCHEME` instead of a hardcoded copy.
- f099524: Take the Better Auth configuration from `@oppenheimer/auth` instead of a local copy.
- Updated dependencies [1a51afc]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
  - @oppenheimer/design-system-mobile@0.3.0
  - @oppenheimer/frontend-core@0.3.0
  - @oppenheimer/frontend-mobile@0.2.0
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/api-client@0.3.0
  - @oppenheimer/translations@0.3.0
  - @oppenheimer/frontend-consumer@0.3.0
  - @oppenheimer/env@0.2.0
  - @oppenheimer/auth@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [4943eff]
- Updated dependencies [e209380]
- Updated dependencies [a93cf5d]
- Updated dependencies [55e1d1a]
- Updated dependencies [9c3e158]
- Updated dependencies [68348a6]
- Updated dependencies [719859f]
  - @oppenheimer/shared@0.2.0
  - @oppenheimer/frontend-core@0.2.0
  - @oppenheimer/api-client@0.2.0
  - @oppenheimer/translations@0.2.0
