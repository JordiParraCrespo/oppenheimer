# @oppenheimer/tsconfig — Agent Instructions

Shared TypeScript configuration presets extended by every app and package.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first.

## Contents

```
tsconfig.base.json      # shared compiler options every other preset extends
tsconfig.library.json   # base for shared library packages
tsconfig.nestjs.json    # backend (apps/api, backend/*)
tsconfig.nextjs.json    # Next.js apps (showcases)
vite-chunks.mjs         # Rollup manualChunks for the Vite SPA
vitest-frontend.mjs     # shared Vitest project config for the frontend apps/kits
```

Consumers reference the tsconfigs via
`"extends": "@oppenheimer/tsconfig/tsconfig.*.json"` in their own `tsconfig.json`, and
`vite-chunks.mjs` via `import { vendorChunks } from '@oppenheimer/tsconfig/vite-chunks.mjs'`
in `vite.config.ts` (typed by the `.d.mts` beside it). It lives here rather than
in `apps/web` so that any Vite SPA in the repo chunks the same dependency set
the same way.

## When modifying

- Changes here affect **every** consumer's compilation. Prefer additive,
  well-considered changes and verify a representative app/package still builds
  and type-checks.
- Match the preset to the runtime target (library vs NestJS vs Next.js) rather
  than adding per-app overrides upstream.

The dependency-cruiser factories in `depcruise/` are described in [`.agents/rules/frontend-architecture.md`](../../.agents/rules/frontend-architecture.md).
