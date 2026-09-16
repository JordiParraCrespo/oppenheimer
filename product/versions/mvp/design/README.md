# MVP design — version 1

The Claude Design canvas export for the MVP, dropped in verbatim. Open
[`version1/Flow.dc.html`](version1/Flow.dc.html) in a browser: it is the index,
with every screen framed live and linked by name.

The screens are the visual counterpart of [`../05-screens.md`](../05-screens.md);
that note remains the written spec and has not been reconciled with these frames
yet.

## Screens

Under `version1/`, each one a standalone `.dc.html` page at 1440×900.

| Artboard | Screen |
|----------|--------|
| [`Flow`](version1/Flow.dc.html) | Index of the first-run flow; every frame live, in order |
| [`SignIn`](version1/SignIn.dc.html) | Sign in — GitHub, Google, email and password |
| [`CreateAccount`](version1/CreateAccount.dc.html) | Create your account |
| [`ForgotPassword`](version1/ForgotPassword.dc.html) | Reset your password |
| [`CheckEmail`](version1/CheckEmail.dc.html) | Check your email |
| [`SetPassword`](version1/SetPassword.dc.html) | Set a new password |
| [`ConnectGitHub`](version1/ConnectGitHub.dc.html) | Onboarding step 2 — connect GitHub |
| [`AddHost`](version1/AddHost.dc.html) | Onboarding step 3 — add your first host |
| [`FirstSession`](version1/FirstSession.dc.html) | Onboarding step 4 — New session |
| [`SessionsConsole`](version1/SessionsConsole.dc.html) | The console: sidebar, terminal, composer |
| [`Components`](version1/Components.dc.html) | Inventory — every component the screens are built from |

States inside the onboarding screens are live: GitHub flips to connected, the
host registers after a few seconds, the pairing token counts down.

## Design system

`_ds/oppenheimer-design-system-<id>/` is the bound design system —
[`readme.md`](_ds/oppenheimer-design-system-9a255601-c6ba-4ec0-b1ab-7c66dbad2e38/readme.md)
covers the voice, the colour rationing, the type and space ladders and the
component list. `styles.css` is the single entry point; `tokens/` holds the
two-layer colour, type, spacing, radii, elevation and motion tokens,
`components/` the CSS per family (core, forms, navigation, overlays, data,
terminal), `assets/fonts/` SF Pro and SF Mono.

`version1/ds-base.js` loads that system and then overrides the dark ramp: the
system's true black read as a void behind a terminal that is also black, so
canvas, sidebar and terminal sit within a few percent of each other instead.
The one-line `base` constant at the top of that file is what points the
artboards at `../_ds/<folder>`; the layout here already matches it.

## Notes

- This tree is a design export, not application code. It is excluded from Biome
  in the root `biome.json`; nothing in the build graph reads it.
- The design system is not yet the one in `packages/design-system/web`. Porting
  the tokens and components is its own piece of work.
- `uploads/` from the export (the raw pasted screenshots) was left out; the
  photography those became lives in `version1/assets/imagery/`.
