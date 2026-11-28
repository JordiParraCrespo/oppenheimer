# @oppenheimer/design-system-mobile

## 0.3.0

### Minor Changes

- 276f5f1: Bring back the Expo app for 0.5 as a shell drawn from the version-1 export's
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
  - `@oppenheimer/api`: when `MOBILE_SCHEME` is set (opt-in, no default),
    Better Auth trusts `${MOBILE_SCHEME}://` and loads the Expo plugin, so the
    app's sign-in and reset links come back to it; a deployment that does not
    set it trusts no app scheme.

- ddacad2: Material 3 Expressive on Android. `MobileRoot` takes the brand `accent` and seeds every native control with it. New `SearchField` (Material's docked search bar on Android), `LoadingIndicator` (Expressive's wavy circular indicator; the system spinner on iOS) and `HeroAction` (an extended FAB on Android, a Liquid Glass pill on iOS). The Sessions and Employees searches, every spinner and an automation's Run now use them. `@oppenheimer/frontend-mobile` adds `TAB_BAR` and `withAlpha`, and the Android tab bar is icons only, ink and grey on the screen's background, in the app's scheme.
- 74fa02e: Every control the platform has is the platform's: `Switch` and `Checkbox` are `@expo/ui` (SwiftUI on iOS, Material 3 on Android), `SegmentedControl` is new, and the JavaScript look-alikes (dialogs, popovers, dropdown and context menus, tabs, toggle and radio groups, the @gorhom bottom sheet) are removed. An automation's pause switch is Material 3's on Android.
- fdefa41: A session opens on the phone, and the Employees tab lists your bots, each opening its chat (`Mobile.dc.html`).

  - `@oppenheimer/mobile`:
    - **A session:** its name and state in the navigation bar with a ··· menu (Share link; Delete session behind the system's alert). The system's segmented Terminal / Chat switch over the session's stream. A glass dock with what the agent waits on (answered through the API), the keys a phone keyboard lacks, and a reply line. The terminal is drawn natively from `@xterm/headless`. One not live says what can be done: Retry, Restart, or open its cloud run.
    - **Employees:** search, each group with its bots, a row per bot opening its chat. The chat streams as the console's does; the dock carries the approval (with the decisions the API offers) or question the bot waits on, and the message field.
  - `@oppenheimer/frontend-mobile`: `ListGroup`, the grouped card both lists draw. `crypto.randomUUID` and `getRandomValues` come from `expo-crypto` where Hermes has none.
  - `@oppenheimer/frontend-consumer`: `botGroupSections` and `approvalDecisionLooks` move here from the console, so both apps group bots and offer approvals the same way. A bot's stream dials through the platform's event source when one is bound.
  - `@oppenheimer/design-system-mobile`: the eight bot avatar colours.
  - `@oppenheimer/web`: imports those two from the product package; nothing the console shows changes.
  - `@oppenheimer/translations`: `sessions.mobile.*` and `bots.mobile.*`.

- 2d90527: The phone's Sessions tab lists your sessions, as `Mobile.dc.html` draws them.

  - `@oppenheimer/mobile`: search, the All / Needs input / Running / Failed
    chips with their counts, then the sessions waiting on you (what each asks
    under its name), then the rest by project; each row the agent, its state's
    dot, where it runs and its age.
  - `@oppenheimer/frontend-consumer`: `groupByProject`, `matchesQuery` and
    `stateWordFor` move here from the console's sessions feature, so both apps
    group, search and word a session the same way.
  - `@oppenheimer/web`: imports those three from the product package; nothing
    the console shows changes.
  - `@oppenheimer/frontend-mobile`: `formatAge`, the console's compact ages.
  - `@oppenheimer/design-system-mobile`: `useNow`.
  - `@oppenheimer/translations`: `sessions.sidebar.noSessionsPhone`;
    `common.comingToMobile.sessions` is gone.
