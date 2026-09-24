# @oppenheimer/tsconfig

Shared TypeScript configuration bases. Every app and package extends one of
these instead of copy-pasting compiler options, so settings stay consistent
across the monorepo.

## What's inside

| File                    | Extend it from                                                   |
| ----------------------- | ---------------------------------------------------------------- |
| `tsconfig.base.json`    | Nothing directly — the shared options every preset below extends |
| `tsconfig.library.json` | Buildable TS packages (`packages/*`)                             |
| `tsconfig.nestjs.json`  | The NestJS API (`apps/api`, backend packages)                    |
| `tsconfig.nextjs.json`  | Next.js apps (`apps/web-showcase`)                               |

Three build/test-time helpers ride along, for the same reason the tsconfigs do
— one copy, extended rather than pasted: `vite-chunks.mjs` (the Rollup
`manualChunks` for the Vite SPA), `vitest-frontend.mjs` (the shared Vitest
project config `apps/web` and `packages/frontend/web` use),
and `depcruise/*.cjs` (the dependency-cruiser rule factories the frontend apps
and kits extend).

## Usage

Reference the package by name in a `tsconfig.json`:

```json
{
  "extends": "@oppenheimer/tsconfig/tsconfig.library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

This package ships only those files (see the `files` field in `package.json`)
— there is no build step and no runtime code.

## Consumed by

Every app and package in the workspace (as a `devDependency`).
