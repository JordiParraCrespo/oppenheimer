# @oppenheimer/mobile-showcase

An Expo gallery of the mobile design system. Every component that
`@oppenheimer/design-system-mobile` exports is rendered here so it can be reviewed
on a device, in light and dark, before it lands in a product screen. It
carries no product logic and talks to no API.

## Running it

```bash
pnpm --filter @oppenheimer/mobile-showcase dev      # expo start --dev-client
pnpm --filter @oppenheimer/mobile-showcase lint:design
```

It runs in a dev-client build, not Expo Go: the design system's sheets and
icons need native modules.

## Layout

```
app/          # expo-router screens, one per component family
lib/          # the gallery's own helpers
```

The design system itself lives in `packages/frontend/design-system/mobile`; a
component is added there and then given a screen here.

## Depends on / used by

Depends on `@oppenheimer/design-system-mobile`. Nothing depends on it; it is an
optional app the starter prunes with `scripts/starter/features.json`.

See [`AGENTS.md`](./AGENTS.md) for the conventions.
