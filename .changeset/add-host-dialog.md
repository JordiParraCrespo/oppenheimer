---
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

Add host is a dialog in the console, not a trip back through onboarding.

The host chip's foot action and New session's "no host yet" state both used to
navigate to `/onboarding/host`: out of the console, into step 4 of 4 of a flow
the reader had already finished, with a Skip link and a Continue that lands on
Ready rather than back at the composer they were filling in. They open the
version-1 Add host dialog now — the one dialog the design draws
(`product/versions/mvp/05-screens.md`) — with the same instruction in two forms
behind a Command / Agent prompt switch, the token line, and a status line that
resolves in place from "Listening for this host…" to the machine that spent the
token. Use this host closes it with that machine selected for the session being
composed.

The pairing flow moves down with it: `useHostPairing` is a
`@oppenheimer/frontend-consumer` hook now, because the onboarding step and the
dialog run the same one. It still watches the **token** rather than the host
list — an account that already owns a machine answers "is there a host?" the
moment the dialog opens, which would offer a machine nobody had paired.
