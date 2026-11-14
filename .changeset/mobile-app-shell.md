---
"@oppenheimer/mobile": minor
"@oppenheimer/frontend-mobile": minor
"@oppenheimer/design-system-mobile": minor
"@oppenheimer/translations": minor
"@oppenheimer/api": patch
---

Bring back the Expo app for 0.5 as a shell drawn from the version-1 export's
`Mobile.dc.html`.

- `@oppenheimer/mobile`: the welcome screen (the portrait, Google, GitHub or
  email), email sign-in, password reset, and five tabs behind a floating bar:
  Sessions, Employees, Pull requests and Automations say they are coming;
  Account shows who is signed in, light or dark, and signs out. No sign-up:
  an account is made on the web.
- `@oppenheimer/frontend-mobile`: `TabBar`, `TabScreen` and `TabPlaceholder`;
  the reset form checks the two passwords match in its schema, as the web
  does, and the live password checklist is gone; RevenueCat, Sentry,
  PostHog and remote config are dropped; i18n reads the `index.json`
  catalogs; tokens follow the console's palette.
- `@oppenheimer/design-system-mobile`: `Text` gains the export's
  `largeTitle`, `body`, `subhead`, `caption` and `overline` variants and a
  `tone`; `MobileRoot` runs on the npm `@gorhom` packages.
- `@oppenheimer/translations`: `auth.login` gains `continueWithEmail`,
  `emailTitle`, `emailDescription`, `back` and `noAccountMobile`;
  `auth.forgotPassword.notReceived`, `common.error`, and `nav.account`,
  `nav.pullRequestsShort`, `nav.sections` and `nav.mobile`.
- `@oppenheimer/api`: Better Auth trusts `${MOBILE_SCHEME}://` and loads the
  Expo plugin, so the app's sign-in and reset links come back to it.
