# @oppenheimer/design-system-mobile — Agent Instructions

Mobile UI component library: React Native components styled with **NativeWind**
(Tailwind for RN). Consumed by `apps/mobile` and `packages/frontend/mobile`.

> Read the root [`CLAUDE.md`](../../../../CLAUDE.md) and the design-system overview
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
- Export new components from `index.ts`.
- **The floating layer is the platform's glass.** What sits over the content
  (navigation, a floating card, a pill over a photo) is `Glass`: Apple's
  `UIGlassEffect` on iOS 26 and later, the system chrome blur elsewhere.
  Content (a list, a form, a card in the flow) stays solid; glass on content
  is what Apple's guidance tells you not to do.
- **A control the platform has is the platform's.** A choice among options is
  `Select` over `@expo/ui`'s picker, so the menu is SwiftUI's (Liquid Glass
  on iOS 26) or Material's; the tab bar is expo-router's `NativeTabs`; a back
  button is the native stack header's. Never redraw one of these.

## Commands

```bash
pnpm --filter @oppenheimer/design-system-mobile build
pnpm --filter @oppenheimer/design-system-mobile dev
```

See [`.agents/rules/frontend-ui.md`](../../../../.agents/rules/frontend-ui.md) and [`.agents/rules/forms.md`](../../../../.agents/rules/forms.md).
