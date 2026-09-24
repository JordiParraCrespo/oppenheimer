# MVP design — version 1

The Claude Design canvas export for the MVP, dropped in verbatim. Open
[`version1/Flow.dc.html`](version1/Flow.dc.html) in a browser: it is the index,
with every screen framed live and linked by name.

The screens are the visual counterpart of [`../05-screens.md`](../05-screens.md),
which is the written spec; the two were reconciled on 2026-09-19 (see the
decision log in [`../README.md`](../README.md)).

## Screens

Under `version1/`, each one a standalone `.dc.html` page at 1440×900.

| Artboard | Screen |
|----------|--------|
| [`Flow`](version1/Flow.dc.html) | Index of the first-run flow; every frame live, in order |
| [`SignIn`](version1/SignIn.dc.html) | Sign in — GitHub, Google, email and password |
| [`CreateAccount`](version1/CreateAccount.dc.html) | Create your account — first and last name, and a note when a provider sign-in found no account |
| [`ForgotPassword`](version1/ForgotPassword.dc.html) | Reset your password |
| [`CheckEmail`](version1/CheckEmail.dc.html) | Check your email |
| [`SetPassword`](version1/SetPassword.dc.html) | Set a new password |
| [`CreateWorkspace`](version1/CreateWorkspace.dc.html) | Onboarding step 2 — name your workspace and pick its address |
| [`ConnectGitHub`](version1/ConnectGitHub.dc.html) | Onboarding step 3 — connect GitHub |
| [`AddHost`](version1/AddHost.dc.html) | Onboarding step 4 — add your first host |
| [`Ready`](version1/Ready.dc.html) | You're all set — workspace, code and host summary, into the console |
| [`SessionsConsole`](version1/SessionsConsole.dc.html) | The console: sidebar with sessions grouped by project, terminal, composer |
| [`Components`](version1/Components.dc.html) | Inventory — every component the screens are built from |

States inside the onboarding screens are live: the workspace address checks
availability as you type, GitHub flips to connected, the host registers after a
few seconds, the pairing token counts down. Onboarding steps carry a Back link
beside the step counter. In the console the sidebar groups sessions under
projects (each with default repositories, host and agent), a session row
renames, moves to another project or deletes, a new session shows a
"Starting your session" wait, and the terminal header marks the link as
live or reconnecting. `Components` adds the Callout (neutral, info, success,
warning, error).

`version1/assets/agents/` holds the coding-agent marks (Claude Code, OpenCode and
Codex are wired into the composer's harness button; Copilot, Gemini and Cursor
are held in reserve), copied from the Orca repository.

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
- The tokens and the MVP component inventory are ported to
  `packages/frontend/design-system/web` (`src/styles/globals.css` and the components
  listed in `apps/web-showcase/src/lib/toc.ts`), using this folder's version-1
  dark ramp rather than the system's true black. The artboards here remain the
  design record; the showcase is the rendered one. The agent marks in the
  package are inline SVGs from the vendors' brand assets, not the PNG copies
  in `version1/assets/agents/`.
- The 2026-09-24 export also carries a `version2/` canvas (a chat view); it
  is not part of the MVP and was left out, as were `screens/` and
  `screenshots/`.
- `uploads/` from the export (the raw pasted screenshots) was left out; the
  photography those became lives in `version1/assets/imagery/`.
