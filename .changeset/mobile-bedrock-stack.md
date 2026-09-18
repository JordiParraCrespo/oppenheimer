---
"@oppenheimer/mobile": minor
"@oppenheimer/admin-mobile": minor
"@oppenheimer/mobile-showcase": minor
"@oppenheimer/design-system-mobile": minor
"@oppenheimer/frontend-mobile": minor
"@oppenheimer/frontend-core": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": minor
---

Port the rn-bedrock mobile stack into Oppenheimer: Expo SDK 57 + dev client, nitro-fetch, MMKV, Sentry/RevenueCat optional keys, gorhom sheet forks, Legend List, expo-image, nano-icons, hey-api client generation, and namespaced translation files.

- `@oppenheimer/frontend-mobile` owns the shared mobile glue: the MMKV query
  persistence wrapper, the polyfills, `FormField` and SecureStore.
- `@oppenheimer/frontend-core` gains `ConfigManager` under `@oppenheimer/frontend-core/config`.
