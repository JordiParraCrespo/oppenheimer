# @oppenheimer/design-system-mobile

React Native component library for Oppenheimer — shadcn-style components built on
[NativeWind](https://www.nativewind.dev/) and
[`@rn-primitives`](https://rnprimitives.com/) (React Native Reusables). The
component API mirrors `@oppenheimer/design-system-web` so the two platforms stay
consistent. Consumed by `apps/mobile` and previewed in `apps/mobile-showcase`.

## Usage

Import components from their per-component subpath:

```tsx
import { Button } from "@oppenheimer/design-system-mobile/button";
import { Text } from "@oppenheimer/design-system-mobile/text";
import { cn } from "@oppenheimer/design-system-mobile/utils";
```

## What's inside

- `src/components/ui/*` — Accordion, AlertDialog, Avatar, Button, Card, Dialog,
  DropdownMenu, Select, Tabs, Tooltip, Text, and more — each with its own export.
- `src/lib/utils` — `cn()` (clsx + tailwind-merge).

Styling uses NativeWind (Tailwind for React Native). The `@rn-primitives/*`
packages, `nativewind`, `react`, and `react-native` (plus its native
peer libraries) are **peer dependencies** provided by the consuming Expo app —
see `package.json` for the full list.

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
pnpm lint    # biome check src/
```

## Design-system lint

`oxlint.design.json` is this package's configuration for
[`@shadcn/lint`](https://github.com/shadcn-ui/lint): the rules for using its
components, owned by the package that ships them. It recognises
`@oppenheimer/design-system-mobile` imports as components and reads their variants,
so `text-lg` on a `<Text>` is reported with the variants that exist instead.
Every consuming app points its `lint:design` script here:

```json
{ "lint:design": "oxlint -c ../../packages/design-system/mobile/oxlint.design.json app components lib" }
```

Two rules are off that the web configuration keeps. The plugin only reads a
Tailwind v4 theme and this package is NativeWind on Tailwind 3, so
`no-unknown-classes` would judge against v4's class set (`flex-grow` is valid
here, flagged there) and `no-inline-styles` would flag React Native's `style`
prop — NativeWind's `vars()`, Expo's `<StatusBar style>` — which is not CSS.
`no-raw-colors` still catches the stock palette (`text-blue-500`); it just
cannot list this theme's tokens.

Rules are at `warn` until an app's count for one reaches zero; then promote it
to `error` here and it fails CI for every consumer. The rationale for each rule
and the findings it inherited are in `.agents/rules/frontend-ui.md`.

## Consumed by

`apps/mobile`, `apps/mobile-showcase`.
