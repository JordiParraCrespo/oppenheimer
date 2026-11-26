# 0.5 — Mobile

**Goal:** mobile. Follow sessions, answer an agent that is waiting, and
review from a phone.

## What exists to build on

- The console is a web SPA; the terminal is xterm.js over a WebSocket
  (`../console/05-screens.md`, `../foundations/01-protocol.md`).
- The starter's mobile app was pruned from the repository, so a native
  app starts fresh.
- 0.4's notifications, which a phone wants as push.

## Answered (2026-11-14)

- **Native, not a PWA.** An Expo app, `apps/mobile`, brought back from the
  starter with its kit (`packages/frontend/mobile`) and design system
  (`packages/frontend/design-system/mobile`), drawn from the version-1
  export's `Mobile.dc.html`. The export draws iOS and Android frames, and a
  phone wants push, which a native app gets first.
- **A shell first.** The first slice is the welcome screen (Google, GitHub or
  email), email sign-in, password reset, and the console rail's five
  sections in its order, Sessions, Plan, Employees, Automations, Pull
  requests, in the system's tab bar (five is as many as it holds), with
  Account a sheet from the avatar on every tab. Account works (who is signed
  in, light or dark, language, sign out); the five sections say they are
  coming. Each fills in a slice of its own.
- **Push is its own slice**, after the shell: it needs device tokens on the
  API and Expo's push service.
- **Native Liquid Glass, wherever the platform has it** (2026-11-15). The
  tab bar is the system's (`NativeTabs`), selects are SwiftUI's menu picker
  (`@expo/ui`), back buttons are the native header's, and what floats over
  content is `UIGlassEffect` (`expo-glass-effect`): so on iOS 26 it is
  Apple's own Liquid Glass, never a look-alike. Older iOS and Android get
  their own materials (the chrome blur, Material's controls).
  *Widened 2026-11-25:* every control the platform has is the platform's.
  A switch and a checkbox are `@expo/ui`'s (SwiftUI's toggle on iOS, which
  has no checkbox; Material 3's on Android), a choice of two to four short
  views is the native segmented control, a menu is `MenuView`, a
  confirmation is the system alert, and a sheet is a `formSheet` route or
  `@expo/ui`'s sheet. The design system's JavaScript look-alikes of those
  (dialogs, popovers, dropdown and context menus, tabs, toggle and radio
  groups, the @gorhom bottom sheet) are gone, so none can be reached for.
  NativeWind draws only what is the app's own: cards, rows, the chat, the
  terminal, the Sessions filter chips.
  *Expressive on Android, 2026-11-25:* Android follows Material 3 Expressive.
  Every native control is in the brand blue itself, #0071E3, as on the web
  console, not the wallpaper's colours or Material's muted version of it (a
  patch to `@expo/ui` keeps the seed exact); the search over Sessions and Employees is Material's search bar;
  a wait is Expressive's wavy circular indicator; and Run now is the app's
  one hero action, an extended FAB (still a pill in Liquid Glass on iOS). The
  tab bar and headers stay `react-native-screens`' Material Components, which
  Expressive's motion does not reach; the Android tab bar is quiet instead
  of Material's stock purple: icons only, the selected one in ink on a soft
  grey pill, on the screen's background, in the app's light or dark (not the
  phone's), while the brand blue stays on the controls and actions.
- **Mobile leaves sign-up out.** An account is made on the web, where its
  workspace is named; the app's social buttons only sign in. *Changed
  2026-11-15:* the phone has the whole auth flow. Create account (email or a
  provider) provisions the account and its workspace as on the web, the next
  step names the workspace (the console's step two, with its address check),
  and Ready says GitHub and the first host are added from the computer,
  where the repositories and the runner live. Welcome carries the Terms and
  Privacy line, opening the console's pages. Two-factor waits for the
  product to have it: the API's `twoFactor` plugin is off and the console
  has no screen for it.

- **Sessions, then a session, then Employees** (2026-11-15), each a stacked
  pull request on the shell. The Sessions tab lists your sessions as the
  export does (search, the four chips, Needs input first, then by project),
  live on the workspace's change feed. A session opens into the export's
  screen: its state in the navigation bar with a ··· menu (Share link,
  Delete session behind the system's alert), the system's segmented
  Terminal / Chat switch, and a glass dock with what the agent waits on
  (answered through the API, as the Inbox answers it), the keys a phone
  keyboard lacks, and a reply line. Employees lists your bots by group, and
  each opens its chat: the conversation, streamed as the console streams
  it, and a dock with the approval or question card it waits on and the
  message field.
- **Automations** (2026-11-16), stacked on Employees. The tab lists every
  automation on one card (its trigger in words, how its last run went, and
  the system's switch that pauses it), and each opens its page: Active and
  when it runs next (or why it is paused), the trigger, the instructions,
  where it runs, its recent runs, Run now in glass at the foot, and a ···
  menu with Run now, Pause, Duplicate and Delete. Making or editing one
  stays on the computer, where its trigger and repositories are picked.
- **Plan** (2026-11-16), stacked on Automations. The mobile export has no
  Plan frames (its tab bar predates it), so the tab reads the console's
  board (`Tasks.dc.html`, `18-plan-product.md`) on a phone: one list, its
  four columns in order, Done keeping the past week with the rest a tap
  away, the project picked in the system's picker, the counts under the
  title, and Add task at the foot of Not started. A row ticks done, opens
  its session line, and opens the task's page: its notes, its column (the
  system's picker), where it is filed, when it is due, its sessions, and
  Delete behind the system's alert. Milestones, the TODO day, the calendar
  and starting a session from a task stay on the computer for now.
- **The Pull requests tab waits** (2026-11-18). The shell's plan had each
  of the five sections fill in a slice of its own; the owner postponed the
  phone's Pull requests tab. It stays the shell's "coming to mobile"
  placeholder while the other four are built.

## Still open

1. A responsive console and a PWA first, or a native app?
2. Is a terminal usable on a phone, or does mobile lean on 0.7's chat
   display? *Answered 2026-11-15: both.* A session offers Terminal and Chat,
   as the console does. The terminal is drawn natively: the stream's bytes
   go through xterm's own parser, headless, and come back as styled lines,
   with no WebView. Only the Terminal view sizes the host's window (tmux's
   `window-size latest`, the rule a narrow browser window lives with too);
   reading the chat never reflows the terminal on the computer.
3. Push notifications: which events, and through what?
4. What does mobile leave out on purpose (pairing a host, say)?
