# @oppenheimer/api-client — Agent Instructions

Typed API client **auto-generated** from the API's OpenAPI/Swagger spec.
Consumed by `@oppenheimer/frontend-core`, `@oppenheimer/frontend-consumer` and
`@oppenheimer/frontend-admin`.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

## Important: generated code

Most of `src/data-access/api/openapi/` is **generated — do not hand-edit it**.
It is regenerated from `apps/api`'s OpenAPI spec:

```bash
# from repo root, after API controller/DTO changes:
pnpm generate:api-client
# or directly:
pnpm --filter @oppenheimer/api-client generate
```

The `generate` script runs `openapi` against `apps/api/openapi.json`, then a
post-processing step (`scripts/openapi-postprocess.mjs`). Uses union types and
`Api`-postfixed services.

## Layout

```
src/
├── data-access/     # generated client (models + services)
├── common/          # hand-written wrappers/config that survive regeneration
└── index.ts
```

## When modifying

- To change the API surface, edit the **source of truth** — the controllers and
  Swagger decorators in `apps/api` (DTOs in `@oppenheimer/shared`) — then regenerate.
- Only hand-written helpers (e.g. under `common/`) should be edited here.

## Commands

```bash
pnpm --filter @oppenheimer/api-client generate
pnpm --filter @oppenheimer/api-client build
```

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
