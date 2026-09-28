# @oppenheimer/api-client

Typed HTTP client for `apps/api`, **generated** from the API's OpenAPI schema.
The generated client is `src/generated/` (SDK, types, TanStack Query options);
it is overwritten on every regeneration, so never edit it by hand.

## Regenerating

```bash
pnpm generate:api-client   # from the repo root
```

This runs `@hey-api/openapi-ts` against `apps/api/openapi.json` (config in
`openapi-ts.config.ts`). Output lands in `src/generated/` (SDK, types, TanStack
Query `queryOptions` / `queryKeys`). Screens still go through
`@oppenheimer/frontend-core`, `-consumer` and `-admin` wrappers so persist policy
and entity mapping stay in one place.

Regenerate after any change to an API endpoint or its Swagger decorators.
It needs no database, Redis or `.env`: the API boots its module graph without
connecting and stands in a placeholder `BETTER_AUTH_SECRET` when none is set
(`apps/api/src/openapi-env.ts`). Both halves end with `biome check --write`
on what they wrote, so a regeneration with no API change leaves git clean — a
diff after one is a real change to commit.

The legacy class clients under `src/data-access/api/openapi` (`*Api`) are not
regenerated — the post-processing step only rebuilds their index files — and
are kept only for the call sites that still use them. Do not add new callers:
use the SDK in `src/generated/`. When a class's last caller moves to the SDK,
delete the class.

## What's inside

| Export path                        | Contents                                                 |
| ---------------------------------- | -------------------------------------------------------- |
| `@oppenheimer/api-client`          | Client entry point                                       |
| `@oppenheimer/api-client/models`   | Generated request/response models                        |
| `@oppenheimer/api-client/services` | Legacy per-tag service classes (`*Api`), not regenerated |

## One runtime dependency — by design

`package.json` declares exactly one `dependencies` entry:
`@hey-api/client-fetch`, the platform-`fetch`-based client the generated SDK is
built on. Please keep it that way — don't add a second HTTP library (e.g.
axios) here. This is deliberate; see the `"//"` note in `package.json`.

## Consumed by

`@oppenheimer/frontend-core` and `@oppenheimer/frontend-consumer` (each wires the client into its own data-access
layer).
