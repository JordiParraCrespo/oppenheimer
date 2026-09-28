---
"@oppenheimer/api": patch
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/tsconfig": patch
"@oppenheimer/translations": patch
"@oppenheimer/web": patch
---

- `@oppenheimer/api`: every generically named operation has an explicit `operationId`; a nullable enum lists `null`; a session's agent, a project's default agent and a trigger's event are enums in the document.
- `@oppenheimer/api-client`: the legacy `*Api` classes and the `./models` and `./services` exports are removed; `applyApiClientConfig` sets the auth headers on the generated client.
- `@oppenheimer/frontend-core`: `refetchEverythingForNewIdentity`.
- `@oppenheimer/frontend-consumer`: the hosts, projects, installations, automations and API-tokens services are removed (`app.<module>` is the repository); `LIVE_POLL`.
- `@oppenheimer/frontend-web`: `searchText`, `searchFlag`, `searchPage`; `AuthLink` no longer takes `search`.
- `@oppenheimer/tsconfig`: the domain dependency-cruiser rules add `one-api-client`.
- `@oppenheimer/translations`: the `sessions.agents` keys are removed.
- `@oppenheimer/web`: search params are Zod schemas; nuqs is removed.
