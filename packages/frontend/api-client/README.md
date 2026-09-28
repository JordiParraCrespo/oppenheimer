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

Every operation has a name the API chose: a controller method whose name is
generic (`list`, `revoke`) carries an explicit `@ApiOperation({ operationId })`,
so the SDK never numbers a collision (`list6`) and a caller never falls back to
a hand-written URL. There is one client; `pnpm arch` fails on a path into this
package's `src/`.

## What's inside

| Export                          | Contents                                                     |
| ------------------------------- | ------------------------------------------------------------ |
| `heyApiSdk`                     | One function per operation, returning `{ data, error, response }` |
| `heyApiQuery`, `heyApiClient`   | The generated TanStack Query helpers and the fetch client    |
| `applyApiClientConfig`          | Base URL, credentials and auth headers, set once at boot     |
| `*ResponseDto`, `*Request`      | Every wire type the API names                                |

## One runtime dependency — by design

`package.json` declares exactly one `dependencies` entry:
`@hey-api/client-fetch`, the platform-`fetch`-based client the generated SDK is
built on. Please keep it that way — don't add a second HTTP library (e.g.
axios) here. This is deliberate; see the `"//"` note in `package.json`.

## Consumed by

`@oppenheimer/frontend-core` and `@oppenheimer/frontend-consumer` (each wires the client into its own data-access
layer).
