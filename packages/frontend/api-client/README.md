# @oppenheimer/api-client

Typed HTTP client for `apps/api`, **generated** from the API's OpenAPI schema.
The generated client is `src/generated/` (the SDK and its types);
it is overwritten on every regeneration, so never edit it by hand.

## Regenerating

```bash
pnpm generate:api-client   # from the repo root
```

This runs `@hey-api/openapi-ts` against `apps/api/openapi.json` (config in
`openapi-ts.config.ts`). Output lands in `src/generated/`. Screens go through
the repositories and query hooks of `@oppenheimer/frontend-core` and
`-consumer`, so persist policy and entity mapping stay in one place.

Regenerate after any change to an API endpoint or its Swagger decorators.
It needs no database, Redis or `.env`: the API boots its module graph without
connecting and stands in a placeholder `BETTER_AUTH_SECRET` when none is set
(`apps/api/src/openapi-env.ts`). Both halves end with `biome check --write`
on what they wrote, so a regeneration with no API change leaves git clean — a
diff after one is a real change to commit.

Every operation is named by one factory in the API
(`apps/api/src/openapi-document.ts`): a slice's controller,
`<UseCase>HttpController`, gives its use case (`FindHostsHttpController` is
`findHosts`), and any other controller its method name. Two handlers on one
name fail the document's generation, so the SDK never numbers a collision and
a caller never falls back to a hand-written URL. There is one client: the
package exports the SDK and nothing that would call the API around it, and
`pnpm arch` fails on a path into its `src/`.

## What's inside

| Export                          | Contents                                                     |
| ------------------------------- | ------------------------------------------------------------ |
| `heyApiSdk`                     | One function per operation, returning `{ data, error, response }` |
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
