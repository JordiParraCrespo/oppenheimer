---
"@oppenheimer/web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/design-system-web": patch
"@oppenheimer/translations": minor
"@oppenheimer/web-showcase": patch
---

Add a host leads with the agent prompt, in onboarding and in the console's
dialog, as the 2026-10-13 design export draws it.

- `@oppenheimer/frontend-web`: `PairingChrome` is agent first: the agent
  prompt in a card with Copy prompt (its text behind a fold), the token line
  with "Install manually instead" across from it (the install command on
  one line with its Copy, and the installer's digest), and a Connection
  list — Runner installed with its version, then Host connected with the
  machine's name and OS. The two folds are `Disclosure`s; the chrome's
  root carries `data-layout`, and each part sizes itself from it, so
  `PairingToken`, `PairingInstruction` and `PairingStatus` lose their
  `layout` prop. `PairedMachine` gains `runnerVersion`.
- `@oppenheimer/web`: the onboarding step puts Continue, Skip for now and
  its note on one row; the dialog's copy follows the export.
- `@oppenheimer/design-system-web`: `Disclosure`'s doc no longer names Add
  a host.
- `@oppenheimer/web-showcase`: the Add a host demo draws the same column.
- `@oppenheimer/translations`: `hosts.pairing` gains `manual`,
  `manualLead`, `connection`, `installWaiting`,
  `installed` and `connected`; `copyPrompt` reads "Copy prompt";
  `copyCommand` and `inspect` are removed. `hosts.add.description`,
  `onboarding.flow.host.description` and `skipNote` follow the export.
