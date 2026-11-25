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
  prop/variant names (`checked`/`onCheckedChange`, `value`/`onValueChange`) so
  consumers get a consistent cross-platform API, even where the control is native.
- Colors/spacing/typography come from the shared design tokens — don't hardcode.
- Export new components from `index.ts`.
- **The floating layer is the platform's glass.** What sits over the content
  (navigation, a floating card, a pill over a photo) is `Glass`: Apple's
  `UIGlassEffect` on iOS 26 and later, the system chrome blur elsewhere.
  Content (a list, a form, a card in the flow) stays solid; glass on content
  is what Apple's guidance tells you not to do.
- **A control the platform has is the platform's.** Never redraw one; the
  JavaScript look-alikes were deleted so none can be reached for:

  | Need | Use |
  | --- | --- |
  | on/off setting | `Switch` (`@expo/ui`: SwiftUI toggle / Material 3 switch) |
  | yes/no in a form | `Checkbox` (Material 3 checkbox; a toggle on iOS, which has none) |
  | one of a list | `Select` (`@expo/ui` menu picker) |
  | one of two to four short views | `SegmentedControl` (`UISegmentedControl` / M3 segmented buttons) |
  | actions on a thing | `MenuView` from `@expo/ui/community/menu` |
  | confirm or report a failure | `Alert.alert` from `react-native` |
  | a sheet | a `presentation: 'formSheet'` route, or `@expo/ui`'s `BottomSheet` |
  | tab bar, back button | expo-router's `NativeTabs`, the native stack header |

  A new `@expo/ui` control is drawn inside `NativeHost` (`src/lib/native-scheme`),
  which sizes it to its content and gives it the app's light or dark; a control
  that takes an appearance prop reads `useNativeScheme()`.
  A native control takes no `className`: lay it out from the view around it,
  and give one with no visible label an `accessibilityLabel`. NativeWind draws
  only what is the app's own (cards, rows, the chat, the terminal).

## Commands

```bash
pnpm --filter @oppenheimer/design-system-mobile build
pnpm --filter @oppenheimer/design-system-mobile dev
```

See [`.agents/rules/frontend-ui.md`](../../../../.agents/rules/frontend-ui.md) and [`.agents/rules/forms.md`](../../../../.agents/rules/forms.md).
