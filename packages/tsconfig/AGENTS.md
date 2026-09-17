# @oppenheimer/tsconfig — Agent Instructions

Shared TypeScript configuration presets extended by every app and package.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first.

## Contents

```
tsconfig.library.json   # base for shared library packages
tsconfig.nestjs.json    # backend (apps/api, backend/*)
tsconfig.nextjs.json    # Next.js apps (showcases)
tsconfig.expo.json      # Expo apps (mobile, admin-mobile)
vite-chunks.mjs         # Rollup manualChunks shared by the Vite SPAs
```

Consumers reference the tsconfigs via
`"extends": "@oppenheimer/tsconfig/tsconfig.*.json"` in their own `tsconfig.json`, and
`vite-chunks.mjs` via `import { vendorChunks } from '@oppenheimer/tsconfig/vite-chunks.mjs'`
in `vite.config.ts` (typed by the `.d.mts` beside it). It lives here rather than
in either app because `apps/web` and `apps/admin-web` ship the same dependency
set and must chunk it the same way.

## When modifying

- Changes here affect **every** consumer's compilation. Prefer additive,
  well-considered changes and verify a representative app/package still builds
  and type-checks.
- Match the preset to the runtime target (library vs NestJS vs Next.js) rather
  than adding per-app overrides upstream.

The dependency-cruiser factories in `depcruise/` are described in [`.agents/rules/frontend-architecture.md`](../../.agents/rules/frontend-architecture.md).
