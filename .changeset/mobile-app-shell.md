---
"@oppenheimer/mobile": minor
"@oppenheimer/frontend-mobile": minor
"@oppenheimer/design-system-mobile": minor
"@oppenheimer/translations": minor
"@oppenheimer/api": patch
---

Bring back the Expo app for 0.5 as a shell drawn from the version-1 export's
`Mobile.dc.html`, in native Liquid Glass on iOS 26.

- `@oppenheimer/mobile`: the welcome screen (the portrait, Google, GitHub or
  email), email sign-in, password reset, and the console rail's five sections
  in its order (Sessions, Plan, Employees, Automations, Pull requests) in the
  system's tab bar, each saying it is coming; Account, a sheet from the
  avatar on every tab, shows who is signed in, light or dark, the language, and signs
  out. The whole auth flow: Create account (email or a provider), the
  workspace step (name and address, checked as typed) and Ready, with Terms
  and Privacy on Welcome opening the console's pages.
- `@oppenheimer/frontend-mobile`: `AuthLayout` is the export's frame (large
  title under the native header, a footer); `BrandLogo`, `BrandGlyph` and
  `ThemeToggle` are gone; `TabScreen` and `TabPlaceholder` (the tab
  bar is expo-router's `NativeTabs`); `LanguageSwitcher` is a native select;
  the reset form checks the two passwords match in its schema, as the web
  does, and the live password checklist is gone; RevenueCat, Sentry,
  PostHog and remote config are dropped; i18n reads the `index.json`
  catalogs; tokens follow the console's palette.
- `@oppenheimer/design-system-mobile`: `Glass` (Apple's `UIGlassEffect` on
  iOS 26, the system blur elsewhere); `Select` is now the platform's menu
  picker over `@expo/ui`, replacing the drawn rn-primitives select;
  `useDebouncedValue`; `Text` gains the export's
  `largeTitle`, `body`, `subhead`, `caption` and `overline` variants and a
  `tone` (`success` among them); `MobileRoot` runs on the npm `@gorhom` packages.
- `@oppenheimer/translations`: `auth.login` gains `continueWithEmail`,
  `emailTitle` and `emailDescription`; `auth.register.phoneDescription`;
  `onboarding.flow.ready.onComputer` and `open`;
  `auth.forgotPassword.notReceived`, `common.error`, and `nav.account`,
  `nav.pullRequestsShort`; `common.comingToMobile`.
- `@oppenheimer/api`: Better Auth trusts `${MOBILE_SCHEME}://` and loads the
  Expo plugin, so the app's sign-in and reset links come back to it.
