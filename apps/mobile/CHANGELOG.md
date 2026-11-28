# @oppenheimer/mobile

## 0.2.0

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

- be38e84: The phone's Automations tab, as `Mobile.dc.html` draws it.

  - `@oppenheimer/mobile`:
    - **The list:** every automation on one card, with its trigger in words, how its last run went, and the system's switch that pauses it.
    - **An automation's page:** Active and its next run (or why it is paused), the trigger, the instructions, where it runs, and its recent runs. Run now sits in glass at the foot. The system's ··· menu has Run now, Pause or Resume, Duplicate, and Delete behind the system's alert.
  - `@oppenheimer/frontend-consumer`: an automation's words move here, beside the automations module, so both apps say them the same way: its trigger (`triggerListText`, `scheduleText`, `daysText`, `eventLabel`, …, from the web kit) and its status (`runState`, `nextRunText`, `nextInstantText`, `pausedReasonText`, `automationAgentText`, from the console's automations feature).
  - `@oppenheimer/frontend-core`: the date helpers that wording rests on (`dateFormatter`, `viewerTimeZone`, `wallClock`, `weekdayDate`, `clock`, `dayOffset`) move down from the web kit, as product-free `Intl` formatting.
  - `@oppenheimer/frontend-web`: re-exports the date helpers the console reads from the kernel; the trigger wording is no longer the kit's.
  - `@oppenheimer/web`: imports the trigger and status wording from the product package, and `clock` and `dayOffset` from the kit rather than the automations feature's own `lib/time.ts`. Nothing the console shows changes.
  - `@oppenheimer/translations`: `automations.mobile.*`; `common.comingToMobile.automations` is gone.

- 4a4d80f: Native builds are kept by fingerprint and reused by every checkout whose native side matches, so a new worktree installs an existing dev client instead of compiling it again; ccache is on for iOS.
- 00bcee3: The phone's Plan tab: your tasks, as the console's board lays them out.

  - `@oppenheimer/mobile`:
    - **The tab:** the four columns in order on one list. Done keeps the past week, and the rest is a tap away. The project is picked in the system's picker, the counts sit under the title, and Add task is at the foot of Not started. Each row has its done check, where it is filed, its due date, and its session line, which opens the session.
    - **A task's page:** its notes, its column (the system's picker), project, milestone, due date, and its sessions. Delete sits behind the system's alert.
  - `@oppenheimer/frontend-consumer`: these move here from the console's tasks feature, so both apps read and word a board the same way:
    - the board's columns and counts (`boardColumnsOf`, `boardCounts`, `columnOf`, `doneCutoffOf`, `filingOf`, …);
    - a task's card in words (`cardView`, `dueDayLabel`, `TaskDueTone`);
    - its session line (`sessionLineOf`, `taskSessionsOf`, `sessionStateOf`, `mostUrgent`).
  - `@oppenheimer/frontend-core`: `todayIn`, `daysBetween` and `nearDay`, calendar-day arithmetic in no timezone, move down from the web kit.
  - `@oppenheimer/frontend-web`: re-exports `todayIn`; `daysBetween` and `nearDay` are no longer the kit's.
  - `@oppenheimer/web`: imports the board, card and session-line helpers from the product package. Nothing the console shows changes.
  - `@oppenheimer/translations`: `tasks.mobile.*`; `common.comingToMobile.plan` is gone.

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

### Patch Changes

- ee06c2c: Credentials that outlive a session now need a verified email, and a password
  reset takes back API tokens, OAuth grants and browser sessions.

  - `@oppenheimer/api`: minting an API token, approving or exchanging an OAuth
    (MCP) grant, minting a host pairing token and issuing a routine's webhook
    URL are refused with `TOKEN_010` until the account's email is verified, on a
    deployment that delivers email (`email_delivery`: SMTP or Resend; without it
    no address can be verified, so the rule does not apply), and
    the token endpoint refuses a `code` or `refresh_token` that is not a string.
    A password reset ("Forgot password") takes back, in its own transaction, the
    API tokens and OAuth grants issued before it: it sets the account's
    credential cutoff (a migration adds `credential_cutoff` and
    `api_token."issuedAt"`), from which every API token or OAuth grant whose
    chain began earlier, including a token minted by one, is refused; it deletes
    the account's OAuth grants, consents and unexchanged authorization codes; and
    the tokens are then marked revoked. Browser sessions are signed out as
    before. Paired hosts and routine webhook URLs record whether the owner's
    email was verified when they were issued (a migration adds
    `"issuedVerified"` to `host_pairing_token`, `host` and
    `automation_webhook`, backfilled from the owner's address as it is now);
    a reset unpairs the hosts, revokes the unspent pairing tokens and revokes
    the webhook URLs issued unverified, which only a deployment without email
    delivery issues, and keeps the rest. `POST
/v1/admin/users/{id}/set-password` now takes back what a reset does, and
    signs the account's sessions out; when it cannot, it answers `ADMIN_008`
    and is retried. A reset does not take back an OAuth exchange already past
    the grant gate at the instant of the reset (a window of milliseconds). If that transaction fails, the reset answers an error
    rather than success (the new password is already stored; resetting again
    from a new link completes it). Better Auth's
    rate limit keys on the client address `TRUST_PROXY` trusts (the socket's at
    `0`), never on `X-Forwarded-For` as sent. Social-login provider tokens are
    stored encrypted. A migration renames `oauthApplication."redirectURLs"` to
    the `redirectUrls` Better Auth writes, which had broken MCP client
    registration.
  - `@oppenheimer/cli`: `opp login` on an unverified account says to verify the
    email first instead of pointing at a missing permission.
  - `@oppenheimer/translations`: the message for `TOKEN_010`, and the copy of
    the console's Resend verification email action.
  - `@oppenheimer/frontend-core`: `useSendVerificationEmail` and
    `IAuthClient.sendVerificationEmail`, a new verification link to the
    signed-in account's own address.
  - `@oppenheimer/frontend-web`: `ErrorAlert` draws `TOKEN_010` with a Resend
    verification email action that says where the link went, or that it could
    not be sent (Add host, onboarding's host step, a routine's webhook URL, the
    MCP consent screen).
  - `@oppenheimer/web`, `@oppenheimer/mobile`: their auth clients send the link
    through Better Auth's `send-verification-email`.

- ddacad2: Material 3 Expressive on Android. `MobileRoot` takes the brand `accent` and seeds every native control with it. New `SearchField` (Material's docked search bar on Android), `LoadingIndicator` (Expressive's wavy circular indicator; the system spinner on iOS) and `HeroAction` (an extended FAB on Android, a Liquid Glass pill on iOS). The Sessions and Employees searches, every spinner and an automation's Run now use them. `@oppenheimer/frontend-mobile` adds `TAB_BAR` and `withAlpha`, and the Android tab bar is icons only, ink and grey on the screen's background, in the app's scheme.
- 74fa02e: Every control the platform has is the platform's: `Switch` and `Checkbox` are `@expo/ui` (SwiftUI on iOS, Material 3 on Android), `SegmentedControl` is new, and the JavaScript look-alikes (dialogs, popovers, dropdown and context menus, tabs, toggle and radio groups, the @gorhom bottom sheet) are removed. An automation's pause switch is Material 3's on Android.
- 25e143a: The phone follows the workspace's change feed, so the Sessions tab moves when an agent starts waiting on you or a session starts from the computer.

  - `@oppenheimer/frontend-core`: `OppenheimerApp.create` takes an `eventSource` factory (`EventSourceFactory`) for a platform without the browser's `EventSource`; unset, nothing changes.
  - `@oppenheimer/frontend-consumer`: the workspace stream dials through that factory when one is bound.
  - `@oppenheimer/frontend-mobile`: `createEventSourceFactory(headers)`, Server-Sent Events over `react-native-sse` carrying the session cookie; a refusal stays closed, a drop redials.
  - `@oppenheimer/mobile`: the workspace gate holds the feed open for every tab.

- Updated dependencies [6bc01b2]
- Updated dependencies [bfb4d0d]
- Updated dependencies [e711f5c]
- Updated dependencies [a602949]
- Updated dependencies [fd6277d]
- Updated dependencies [db4efe1]
- Updated dependencies [566f850]
- Updated dependencies [ad7e6ac]
- Updated dependencies [7b5c7b3]
- Updated dependencies [c9aa79c]
- Updated dependencies [84ae987]
- Updated dependencies [7b0e91d]
- Updated dependencies [1d57cbf]
- Updated dependencies [43193e4]
- Updated dependencies [a2d35a8]
- Updated dependencies [dfd07de]
- Updated dependencies [e75f5fd]
- Updated dependencies [bb76bed]
- Updated dependencies [1df2b19]
- Updated dependencies [7944eae]
- Updated dependencies [172b7ab]
- Updated dependencies [db21b92]
- Updated dependencies [4c75b47]
- Updated dependencies [344ce8c]
- Updated dependencies [d314623]
- Updated dependencies [d5d4fd4]
- Updated dependencies [c5c09d0]
- Updated dependencies [1819aa6]
- Updated dependencies [be15bdc]
- Updated dependencies [38ffaaf]
- Updated dependencies [e315b92]
- Updated dependencies [b6576e2]
- Updated dependencies [a51a958]
- Updated dependencies [fb3681f]
- Updated dependencies [b283349]
- Updated dependencies [cfa236a]
- Updated dependencies [434deea]
- Updated dependencies [0d83e40]
- Updated dependencies [9ccced3]
- Updated dependencies [6568fab]
- Updated dependencies [a7c8731]
- Updated dependencies [b37663a]
- Updated dependencies [c4b0995]
- Updated dependencies [be941d8]
- Updated dependencies [b639f26]
- Updated dependencies [929db14]
- Updated dependencies [4faf606]
- Updated dependencies [4fb1e39]
- Updated dependencies [3d54930]
- Updated dependencies [8612fd8]
- Updated dependencies [18e4a35]
- Updated dependencies [7f18bbe]
- Updated dependencies [4201798]
- Updated dependencies [8fc6c25]
- Updated dependencies [39dbe36]
- Updated dependencies [f46ca03]
- Updated dependencies [d2ff254]
- Updated dependencies [201ee3a]
- Updated dependencies [502a40c]
- Updated dependencies [ac929fa]
- Updated dependencies [8deebf8]
- Updated dependencies [5dfebed]
- Updated dependencies [e338973]
- Updated dependencies [87d0f96]
- Updated dependencies [39d9703]
- Updated dependencies [59809f9]
- Updated dependencies [060dabb]
- Updated dependencies [a23f236]
- Updated dependencies [e0047a2]
- Updated dependencies [f09b6b3]
- Updated dependencies [3dbe5f1]
- Updated dependencies [24ca7aa]
- Updated dependencies [629ea1d]
- Updated dependencies [bc448db]
- Updated dependencies [581c202]
- Updated dependencies [6dd3dc7]
- Updated dependencies [c7a6f7a]
- Updated dependencies [6af341b]
- Updated dependencies [8278d9c]
- Updated dependencies [73ebf15]
- Updated dependencies [ad1c673]
- Updated dependencies [fcb29f7]
- Updated dependencies [0044013]
- Updated dependencies [9716225]
- Updated dependencies [300363e]
- Updated dependencies [0f9c3ca]
- Updated dependencies [d5ebd8d]
- Updated dependencies [419f41c]
- Updated dependencies [2128771]
- Updated dependencies [f93ffbe]
- Updated dependencies [8a8749d]
- Updated dependencies [8b529a9]
- Updated dependencies [ef405cd]
- Updated dependencies [c11f8a3]
- Updated dependencies [8baff58]
- Updated dependencies [9f858e0]
- Updated dependencies [b39d40f]
- Updated dependencies [74b1f8b]
- Updated dependencies [33cb1d8]
- Updated dependencies [55acf65]
- Updated dependencies [3230edb]
- Updated dependencies [f6a81a2]
- Updated dependencies [7a8851a]
- Updated dependencies [61f1092]
- Updated dependencies [dc67559]
- Updated dependencies [0fed04c]
- Updated dependencies [ca796db]
- Updated dependencies [3ffa099]
- Updated dependencies [6eb8d65]
- Updated dependencies [ee06c2c]
- Updated dependencies [b4c35f9]
- Updated dependencies [3666563]
- Updated dependencies [47e4398]
- Updated dependencies [fc246b3]
- Updated dependencies [c90bcf1]
- Updated dependencies [96a8a1b]
- Updated dependencies [9402a5a]
- Updated dependencies [acb27dc]
- Updated dependencies [17e4cd5]
- Updated dependencies [caa731f]
- Updated dependencies [d68e9c4]
- Updated dependencies [d577bfe]
- Updated dependencies [bdc964b]
- Updated dependencies [500ddd1]
- Updated dependencies [33cb1d8]
- Updated dependencies [ab9a6f4]
- Updated dependencies [3e1fa7d]
- Updated dependencies [aeeb48b]
- Updated dependencies [af020b8]
- Updated dependencies [291469b]
- Updated dependencies [fda123f]
- Updated dependencies [a74c86a]
- Updated dependencies [85c11ad]
- Updated dependencies [4fefacd]
- Updated dependencies [48da240]
- Updated dependencies [1484bc6]
- Updated dependencies [02894e4]
- Updated dependencies [dd3acdd]
- Updated dependencies [cca8cfb]
- Updated dependencies [60fe272]
- Updated dependencies [ce6374e]
- Updated dependencies [50c9d05]
- Updated dependencies [7c0a70c]
- Updated dependencies [7c0a70c]
- Updated dependencies [c33abbe]
- Updated dependencies [35f32be]
- Updated dependencies [c63402e]
- Updated dependencies [ac40af9]
- Updated dependencies [4bc2e95]
- Updated dependencies [2214b16]
- Updated dependencies [276f5f1]
- Updated dependencies [be38e84]
- Updated dependencies [ddacad2]
- Updated dependencies [74fa02e]
- Updated dependencies [00bcee3]
- Updated dependencies [fdefa41]
- Updated dependencies [2d90527]
- Updated dependencies [25e143a]
- Updated dependencies [d2644b5]
- Updated dependencies [fa1a47b]
- Updated dependencies [1f2290d]
- Updated dependencies [8d1b3c4]
- Updated dependencies [0ed584c]
- Updated dependencies [11265d7]
- Updated dependencies [814aa6c]
- Updated dependencies [5b48b5e]
- Updated dependencies [9b0c57f]
- Updated dependencies [6bb3a80]
- Updated dependencies [a3cf769]
- Updated dependencies [a3a780b]
- Updated dependencies [1496a5f]
- Updated dependencies [749cf21]
- Updated dependencies [70eb8ea]
- Updated dependencies [da6226c]
- Updated dependencies [3b5d381]
- Updated dependencies [a6d67d7]
- Updated dependencies [9871b11]
- Updated dependencies [bf71f50]
- Updated dependencies [250c8d6]
- Updated dependencies [0079b26]
- Updated dependencies [04188eb]
- Updated dependencies [67df985]
- Updated dependencies [5c8b948]
- Updated dependencies [0f2f802]
- Updated dependencies [52d7e8c]
- Updated dependencies [a80436f]
- Updated dependencies [146d7d1]
- Updated dependencies [d4606c6]
- Updated dependencies [0b173cc]
- Updated dependencies [0a0c8a4]
- Updated dependencies [50cbfa3]
- Updated dependencies [4f9afb3]
- Updated dependencies [1dbae54]
- Updated dependencies [ce53664]
- Updated dependencies [6917f62]
- Updated dependencies [6168d0e]
- Updated dependencies [71d4e51]
- Updated dependencies [8b772b8]
- Updated dependencies [d69ddc4]
- Updated dependencies [e511fb2]
- Updated dependencies [ecf6d14]
- Updated dependencies [d687bfd]
- Updated dependencies [b3b6805]
- Updated dependencies [1a47694]
- Updated dependencies [75a1594]
- Updated dependencies [45604ff]
- Updated dependencies [3fd3efb]
- Updated dependencies [c0515d4]
- Updated dependencies [d687bfd]
- Updated dependencies [aa92290]
- Updated dependencies [8168686]
- Updated dependencies [2c0fbb5]
- Updated dependencies [ea93480]
- Updated dependencies [11fa44a]
- Updated dependencies [c461e78]
- Updated dependencies [758963a]
- Updated dependencies [dd942da]
- Updated dependencies [45d642b]
- Updated dependencies [fe61b51]
- Updated dependencies [e1dbf21]
- Updated dependencies [ec96195]
- Updated dependencies [341cafa]
- Updated dependencies [1f7f57b]
- Updated dependencies [ac71ace]
- Updated dependencies [6125030]
- Updated dependencies [97f9547]
- Updated dependencies [04b0f76]
- Updated dependencies [b5a9490]
- Updated dependencies [dd40ea3]
- Updated dependencies [1fcf738]
- Updated dependencies [d2df32e]
- Updated dependencies [55f82ea]
- Updated dependencies [a58c432]
- Updated dependencies [514fce1]
- Updated dependencies [ed475aa]
- Updated dependencies [db80935]
- Updated dependencies [4189871]
- Updated dependencies [c8c4f9b]
- Updated dependencies [69228fc]
- Updated dependencies [f8eda6e]
- Updated dependencies [db4ae58]
- Updated dependencies [1062c57]
- Updated dependencies [13374f0]
- Updated dependencies [a68c88c]
- Updated dependencies [a69aa94]
- Updated dependencies [ec55a80]
- Updated dependencies [cc244a1]
- Updated dependencies [828d404]
- Updated dependencies [2d187ed]
- Updated dependencies [8da03fc]
- Updated dependencies [8fef0a2]
- Updated dependencies [a56308b]
- Updated dependencies [9706ce9]
- Updated dependencies [06b40ca]
- Updated dependencies [3da961d]
- Updated dependencies [a573d78]
- Updated dependencies [62bef8b]
- Updated dependencies [5b1c52a]
- Updated dependencies [2f80e64]
- Updated dependencies [4ee069d]
- Updated dependencies [1af8fa3]
- Updated dependencies [4ee069d]
- Updated dependencies [f93932d]
- Updated dependencies [edcc92d]
- Updated dependencies [90cf44b]
- Updated dependencies [27f034a]
- Updated dependencies [718613c]
- Updated dependencies [3029900]
  - @oppenheimer/shared@0.4.0
  - @oppenheimer/translations@0.4.0
  - @oppenheimer/api-client@0.4.0
  - @oppenheimer/frontend-consumer@2.0.0
  - @oppenheimer/frontend-core@0.4.0
  - @oppenheimer/frontend-mobile@0.2.0
  - @oppenheimer/design-system-mobile@0.3.0
  - @oppenheimer/auth@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [4943eff]
- Updated dependencies [e209380]
- Updated dependencies [a93cf5d]
- Updated dependencies [55e1d1a]
- Updated dependencies [9c3e158]
- Updated dependencies [68348a6]
- Updated dependencies [719859f]
  - @oppenheimer/shared@0.2.0
  - @oppenheimer/frontend-core@0.2.0
  - @oppenheimer/api-client@0.2.0
  - @oppenheimer/translations@0.2.0
