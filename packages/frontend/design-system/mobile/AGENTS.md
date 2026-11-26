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
  | search over a list | `SearchField` (Material 3's docked search bar on Android; a field with the system clear button on iOS). It owns its text and reports it with `onQueryChange`, `''` on every mount; there is no `value` |
  | something on its way | `LoadingIndicator` (Material 3 Expressive's wavy circular indicator on Android, the system spinner on iOS), never `ActivityIndicator` |
  | the screen's one primary action | `HeroAction` (Expressive extended FAB on Android, a pill in Liquid Glass on iOS). Its `icon` is a name in `HERO_ICONS`, which maps it to Lucide and to a Material Symbol |
  | tab bar, back button | expo-router's `NativeTabs` (on Android coloured whole from `TAB_BAR` in `@oppenheimer/frontend-mobile`, the brand blue in the app's scheme), the native stack header |

  A new `@expo/ui` control is drawn inside `NativeHost` (`src/lib/native-scheme`),
  which sizes it to its content and gives it the app's light or dark, so a caller
  places a native control and never gives it a pixel width. A control that needs
  each platform's own primitives splits into `src/lib/<name>.ios.tsx` and
  `.android.tsx` (Metro picks one), as `native-segmented` does.
  On Android every control is Material 3 Expressive (`@expo/ui`'s host wraps
  it in `MaterialExpressiveTheme`), seeded with the brand accent `MobileRoot`
  is given, so its palette is ours and not the wallpaper's. `patches/@expo__ui@57.0.26.patch` keeps that
  seed exact: Material's fidelity scheme and the seed itself as `primary`,
  where stock `@expo/ui` mutes it. A change to it needs a new dev build;
  carry it to each `@expo/ui` upgrade, or drop it once Expo offers the choice. Expressive's
  "hero moment" is used sparingly: a screen has at most one `HeroAction`, and
  only where that action is the point of the screen (Run now on an
  automation).

  A native control takes no `className`: lay it out from the view around it,
  and give one with no visible label an `accessibilityLabel`. NativeWind draws
  only what is the app's own (cards, rows, the chat, the terminal).

## Commands

```bash
pnpm --filter @oppenheimer/design-system-mobile build
pnpm --filter @oppenheimer/design-system-mobile dev
```

See [`.agents/rules/frontend-ui.md`](../../../../.agents/rules/frontend-ui.md) and [`.agents/rules/forms.md`](../../../../.agents/rules/forms.md).
