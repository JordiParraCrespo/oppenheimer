# @oppenheimer/config

Shared TypeScript configuration bases. Every app and package extends one of
these instead of copy-pasting compiler options, so settings stay consistent
across the monorepo.

## What's inside

| File                    | Extend it from                                                   |
| ----------------------- | ---------------------------------------------------------------- |
| `tsconfig.library.json` | Buildable TS packages (`packages/*`)                             |
| `tsconfig.nestjs.json`  | The NestJS API (`apps/api`, backend packages)                    |
| `tsconfig.nextjs.json`  | Next.js apps (`apps/web-showcase`)                               |
| `tsconfig.expo.json`    | Expo / React Native apps (`apps/mobile`, `apps/mobile-showcase`) |

## Usage

Reference the package by name in a `tsconfig.json`:

```json
{
  "extends": "@oppenheimer/config/tsconfig.library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

This package ships only the `tsconfig.*.json` files (see the `files` field in
`package.json`) — there is no build step and no runtime code.

## Consumed by

Every app and package in the workspace (as a `devDependency`).
