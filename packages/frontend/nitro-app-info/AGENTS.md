# @oppenheimer/nitro-app-info — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

## Where things go

- A new native method is added to the spec in `src/AppInfo.nitro.ts`, then to
  `ios/` (Swift) and `android/` (Kotlin), then `pnpm --filter @oppenheimer/nitro-app-info nitrogen`
  regenerates `nitrogen/`. Never edit the generated bindings by hand.
- The JS surface stays `src/index.ts`; the loader is the only place that
  knows which platforms exist.
- Anything that is not native belongs in `@oppenheimer/frontend-mobile`, not here.

## Before pushing

```bash
pnpm --filter @oppenheimer/nitro-app-info nitrogen
pnpm --filter @oppenheimer/nitro-app-info lint
```

The module can only be exercised in a dev-client build of an Expo app; there
is no unit test to run here.

## Patterns agents get wrong

- Editing the generated `nitrogen/` output instead of the spec.
- Importing the module from a platform kit or a domain package. It is
  app-level platform glue; the Expo apps import it, nothing shared does.
- Assuming Expo Go: Nitro modules need `expo-dev-client`.

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
