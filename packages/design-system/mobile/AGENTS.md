# @oppenheimer/design-system-mobile — Agent Instructions

Mobile UI component library: React Native components styled with **NativeWind**
(Tailwind for RN). Consumed by `apps/mobile` and `apps/mobile-showcase`.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and the design-system overview
> in [`../AGENTS.md`](../AGENTS.md) first.

## Layout

```
src/
├── components/         # React Native components
├── lib/               # utils (cn, variants, etc.)
├── nativewind-env.d.ts
└── index.ts           # public exports
```

## Conventions

- Styling is **NativeWind** (Tailwind classes on RN primitives), not Tamagui.
- **Mirror the shadcn component API** from `@oppenheimer/design-system-web`: matching
  prop/variant names so consumers get a consistent cross-platform API.
- Colors/spacing/typography come from the shared design tokens — don't hardcode.
- Export new components from `index.ts`; preview them in `apps/mobile-showcase`.

## Commands

```bash
pnpm --filter @oppenheimer/design-system-mobile build
pnpm --filter @oppenheimer/design-system-mobile dev
```
