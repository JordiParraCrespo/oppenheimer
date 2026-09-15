# @oppenheimer/api-client

Typed HTTP client for `apps/api`, **generated** from the API's OpenAPI schema.
Do not hand-edit files under `src/data-access/api/openapi` — they are overwritten
on every regeneration.

## Regenerating

```bash
pnpm generate:api-client   # from the repo root
```

This runs `@hey-api/openapi-ts` against `apps/api/openapi.json` (config in
`openapi-ts.config.ts`). Output lands in `src/generated/` (SDK, types, TanStack
Query `queryOptions` / `queryKeys`). Screens still go through `@oppenheimer/frontend`
wrappers so persist policy and entity mapping stay in one place.

Regenerate after any change to an API endpoint or its Swagger decorators. The
legacy class client under `src/data-access/` remains until call sites finish
moving to the SDK.

## What's inside

| Export path                  | Contents                                   |
| ---------------------------- | ------------------------------------------ |
| `@oppenheimer/api-client`          | Client entry point                         |
| `@oppenheimer/api-client/models`   | Generated request/response models          |
| `@oppenheimer/api-client/services` | Generated per-tag service classes (`*Api`) |

## No runtime dependencies — by design

`package.json` intentionally declares **no `dependencies`** field, only
`devDependencies`. The generated client is self-contained (it uses the platform
`fetch`); the consuming app supplies configuration. Please keep it that way —
don't add an HTTP library here. This is not an oversight; see the `"//"` note in
`package.json`.

## Consumed by

`packages/frontend` (which wires the client into its data-access layer).
