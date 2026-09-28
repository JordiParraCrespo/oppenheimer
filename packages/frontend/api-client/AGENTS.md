# @oppenheimer/api-client — Agent Instructions

Typed API client **auto-generated** from the API's OpenAPI/Swagger spec.
Consumed by `@oppenheimer/frontend-core` and `@oppenheimer/frontend-consumer`.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

## Important: generated code

`src/generated/` and `src/index.ts` are **generated — do not hand-edit them**.
They are regenerated from `apps/api`'s OpenAPI spec:

```bash
# from repo root, after API controller/DTO changes:
pnpm generate:api-client
# or directly:
pnpm --filter @oppenheimer/api-client generate
```

The `generate` script runs `openapi-ts` against `apps/api/openapi.json`, then
`scripts/openapi-postprocess.mjs`, which writes the root barrel. A repository
calls `heyApiSdk.<operation>` through `unwrap` / `unwrapBody` from
`@oppenheimer/frontend-core`; there is no second client.

## Layout

```
src/
├── generated/       # openapi-ts output: SDK, types, TanStack Query helpers
├── configure.ts     # hand-written: base URL, credentials, auth headers
└── index.ts         # generated barrel
```

## When modifying

- To change the API surface, edit the **source of truth** — the controllers and
  Swagger decorators in `apps/api` (DTOs in `@oppenheimer/shared`) — then regenerate.
- A controller method with a generic name (`list`, `revoke`) gets an explicit
  `@ApiOperation({ operationId })`; a numbered SDK function (`list6`) means
  one is missing.
- Only `configure.ts` is hand-written here.

## Commands

```bash
pnpm --filter @oppenheimer/api-client generate
pnpm --filter @oppenheimer/api-client build
```

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
