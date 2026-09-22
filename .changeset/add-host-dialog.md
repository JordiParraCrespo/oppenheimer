---
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

Add host is a dialog in the console.

- `@oppenheimer/web`: New session's host chip opens the Add host dialog instead
  of navigating to `/onboarding/host`; the dialog owns the Command / Agent
  prompt switch, the panel and a footer that arms on a registered host.
- `@oppenheimer/frontend-web`: new `hosts` concern with `HostPairingChrome` —
  the token line and the status row the onboarding step and the dialog both
  draw.
- `@oppenheimer/frontend-consumer`: `useHostPairing` (in `react/hosts.pairing.ts`)
  is the pairing flow both surfaces run; it counts `secondsLeft` rather than
  formatting a clock. `useCurrentPairing`, `usePairingTokens` and `useHosts`'s
  poll are its internals and leave the barrel; the unused `usePairHost` is gone.
- `@oppenheimer/translations`: new `hosts` namespace for the pairing copy both
  surfaces read, `sessions.new.addHost.*` for the dialog's own words, and
  `common.close`.
