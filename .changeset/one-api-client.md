---
"@oppenheimer/api": patch
"@oppenheimer/backend-core": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/tsconfig": patch
"@oppenheimer/translations": patch
"@oppenheimer/web": patch
---

- `@oppenheimer/api`: operations are named by one factory (a slice's use case, otherwise the method) and a collision fails generation; Swagger UI and `openapi.json` come from one builder; a nullable enum lists `null` where its schema is emitted (`nullableEnum`, and a patch to nestjs-zod); a session's agent, a project's default agent and a trigger's event are enums in the document.
- `@oppenheimer/backend-core`: `nullableEnum`.
- `@oppenheimer/api-client`: SDK functions take the API's operation names (`findHosts`, `findSessions`, …); the legacy `*Api` classes and the `./models` and `./services` exports are removed; `applyApiClientConfig` sets the auth headers on the generated client.
- `@oppenheimer/frontend-core`: `refetchEverythingForNewIdentity`.
- `@oppenheimer/frontend-consumer`: the hosts, projects, installations, automations and API-tokens services are removed (`app.<module>` is the repository); `useHostPresence`.
- `@oppenheimer/frontend-web`: `searchText`, `searchFlag`, `searchPage`; `AuthLink` no longer takes `search`.
- `@oppenheimer/tsconfig`: the domain dependency-cruiser rules add `one-api-client`.
- `@oppenheimer/translations`: the `sessions.agents` keys are removed.
- `@oppenheimer/web`: search params are Zod schemas; nuqs is removed.
