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

## A driver's lifecycle

A driver — any class a pluggable module builds behind its abstract service —
goes through the same steps, and each step does only its own work:

1. **Construct: no I/O.** The constructor reads config and stores it. It opens
   no connection, makes no network call and writes nothing to disk.
   `pnpm generate:api-client` boots the whole app with no database or Redis,
   so a constructor that connects hangs or fails it. A client library that
   connects when built is told not to (`lazyConnect: true` for ioredis), and
   a directory a write needs is made by that write.
2. **Validate at boot.** A bad setting fails the boot, not the first request:
   the app's config schema (`apps/api/src/config/`) checks the value, and the
   module's factory refuses a driver name nothing answers to.
3. **Connect late.** On the first call, or in `onModuleInit` /
   `onApplicationBootstrap` when the app should not start without it.
   `NestFactory.create` alone (what `generate:openapi` runs) calls neither.
4. **Tear down.** Whatever step 3 opened is closed in `onModuleDestroy` /
   `beforeApplicationShutdown`, without opening it first if it never was. A
   client the app hands in and owns (the cache's Redis client) is the app's to
   close, not the driver's.

The compiler holds the shape: a driver `extends` its abstract service, so a
missing method fails the build. A lifecycle hook is declared with
`implements OnModuleDestroy` (or the hook it uses), so a misspelled method is
an error rather than a hook Nest never calls.

## No driver library in the public API

What a package exports — `index.ts` and every signature it reaches — names
no type from the library a driver runs on (nodemailer, `@aws-sdk/*`, an LLM
provider SDK, bullmq). A caller written against a library's type is written
against that library, and the driver can no longer change without it. A driver
keeps its client in a `private` field; the abstract service speaks in plain
types.

A package may name the framework (`@nestjs/common`, `@nestjs/core`,
`@nestjs/config`, `rxjs`), the workspace (`@oppenheimer/*`), Node, and the
libraries that are the point of that package: `typeorm` for `ddd` and
`authz`, `oxide.ts` for `ddd`, the pino and Swagger pieces for `core`. Two
entries are conscious exceptions: the cache takes the app's `ioredis` client
(the app owns the connection), and `core` re-exports prometheus's instrument
types. `pnpm check:public-api` (`scripts/check-backend-public-api.mjs`) reads
the declarations `tsc` would emit, in memory, and fails on anything else. A
package's own sources need no build, but the declarations of the packages it
depends on do (`turbo run build --filter='./packages/backend/*'`), and it fails
closed on a package that does not compile. Its `ALLOWED` holds
the list and the reason for each entry. Adding to it is a decision for review,
in its own diff.

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
