# @oppenheimer/env — Agent Instructions

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first.

## Where things go

- The loader is `src/load.ts` (`loadEnv`) and its side-effect entry
  `@oppenheimer/env/load`; `src/index.ts` re-exports. There is nothing else to add
  here: a new variable goes in the root `.env.example` with a note, and is read
  by the app that needs it.
- Its spec is `src/index.spec.ts`: the root walk, the `.env.local` override
  order, and that a real environment variable always wins.

## Before pushing

```bash
pnpm --filter @oppenheimer/env test
pnpm --filter @oppenheimer/env lint
```

## Patterns agents get wrong

- Adding a per-package `.env` or a second loader. There is one `.env`, at the
  repo root; the web apps read it through Vite's `envDir`, the mobile apps in
  `app.config.ts`, the Node apps through this package.
- Overwriting a value that is already set. The loader never does; CI and the
  production containers rely on it.
- Documenting a variable nowhere. `.env.example` is the documentation and
  nothing unread belongs in it.

See [`.agents/rules/api-config.md`](../../.agents/rules/api-config.md).
