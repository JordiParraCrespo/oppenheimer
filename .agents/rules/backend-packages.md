---
paths:
  - "packages/backend/**/*"
---

# Backend Packages Rules

## CJS exports required

All `packages/backend/*` must have both `"import"` and `"require"` in their `package.json` exports. NestJS runs in CommonJS mode and will throw `ERR_PACKAGE_PATH_NOT_EXPORTED` without `"require"`.

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  }
}
```

## Package structure

There are two kinds of backend package:

**Pluggable services** (`email`, `storage`, `cache`, `queue`) — an abstract
service selected at runtime by a factory:

```
packages/backend/<name>/
├── src/
│   ├── index.ts              # Barrel export
│   ├── <name>.service.ts     # Abstract class (interface)
│   ├── <impl>.service.ts     # Concrete implementation(s)
│   └── <name>.module.ts      # @Global DynamicModule with factory
├── package.json
└── tsconfig.json
```

**Library packages** (`core`, `ddd`) — export building blocks (base classes,
interfaces, filters, pipes) with no abstract service or `@Global` module. They
still follow the CJS export and shared-config rules below. `@oppenheimer/backend-ddd`
holds the DDD/hexagon primitives; `@oppenheimer/backend-core` holds cross-cutting
NestJS infrastructure.

## Email package specifics

- `tsconfig.json` must have `"jsx": "react-jsx"` for React Email templates
- `react`, `@react-email/components`, `@react-email/render` are **production** deps (not devDeps)
- Templates live in `src/templates/` as React components

## Shared config dependency

All backend packages depend on `@oppenheimer/tsconfig` for TypeScript config. Reference it via workspace protocol: `"@oppenheimer/tsconfig": "workspace:*"`.

## Deliberate exception: `@oppenheimer/auth` ships TypeScript sources

`packages/auth` (outside `packages/backend/*`, but consumed by the API) breaks
the compiled-CJS convention **on purpose**: its `./client` entry points at
`src/client.ts` rather than a `dist/` build, because Better Auth derives the
client's endpoint and session types from the plugin tuple through inference
chains that do not survive `.d.ts` emission. Vite (web) transpiles the
sources directly. Only the root `@oppenheimer/auth` entry — plain,
explicitly typed config values for the NestJS API — is compiled to CJS +
`.d.ts` like everything else. Do not "fix" `./client` to build like a backend
package; see `packages/auth/README.md`.
