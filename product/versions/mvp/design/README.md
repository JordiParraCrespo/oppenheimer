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
| [`AddHost`](version1/AddHost.dc.html) | Onboarding step 4 — add your first host; the command and agent prompt fold behind "Inspect command and prompt" |
| [`Ready`](version1/Ready.dc.html) | You're all set — workspace, code and host summary, into the console |
| [`SessionsConsole`](version1/SessionsConsole.dc.html) | The console: a rail for sessions and automations, the sidebar grouped by project, terminal, composer |
| [`Routines`](version1/Routines.dc.html) | The console on its automations page — automations grouped by project, their triggers, steps and run history |
| [`Tasks`](version1/Tasks.dc.html) | Plan — the rail's third item: tasks by status (To do, In progress, Later, Done) per project, goals, a calendar synced with Google Calendar, and tasks started as or linked to sessions |
| [`PullRequests`](version1/PullRequests.dc.html) | Pull requests — the rail's fourth item: the queue of pull requests waiting on you, a diff with line comments and a file tree, the review agent, checks, conflicts and merge |
| [`Settings`](version1/Settings.dc.html) | Settings — profile, workspace and hosts (rename, remove, and an Add a host page with the install command and agent prompt) |
| [`Emails`](version1/Emails.dc.html) | Index of the transactional emails, each framed live from `version1/emails/` with when it is sent and its link lifetime |
| [`Components`](version1/Components.dc.html) | Inventory — every component the screens are built from |

States inside the onboarding screens are live: the workspace address checks
availability as you type, GitHub flips to connected, the host registers after a
few seconds, the pairing token counts down. Onboarding steps carry a Back link
beside the step counter. In the console the sidebar groups sessions under
projects (each with default repositories, host and agent), a session row
renames, moves to another project or deletes, a new session shows a
"Starting your session" wait, and the terminal header marks the link as
live or reconnecting. `Components` adds the Callout (neutral, info, success,
warning, error), and the parts the automations and settings pages are built
from: rail, automation rows and table, run history, templates, settings nav
and group, host card, page header, segmented tabs. The console's styles moved
into `version1/console.css`, shared by `SessionsConsole` and `Components`;
`Routines` is `SessionsConsole` opened on its automations page.

Routines were renamed Automations in the 2026-09-26 evening export. The
rename is in the copy only: the file is still `Routines.dc.html` and the
frames' internal names (`page="routines"`, the `routine` state) are
unchanged. The same export turned Add a host from a dialog into a page,
in the console and in Settings.

The 2026-09-27 export turns the console's pages back into dialogs over
the console: New project and Project settings, New and Edit automation,
and Add a host. Settings keeps its Add a host page. The onboarding
AddHost folds the install command and agent prompt behind an "Inspect
command and prompt" disclosure. The export keeps the versions it replaced
as `SessionsConsole (pages).dc.html` and `AddHost (cards).dc.html`,
byte-for-byte the 2026-09-26 frames.

`Emails` and `version1/emails/` are the transactional emails: verify
email, welcome (workspace ready), reset password, password changed,
change email, new sign-in, session completed, failed and needs input,
and workspace invite.

The 2026-10-03 export changes the console and Settings only. New session
opens on a "Ready when you are." heading; the composer takes a dropped
file ("Drop to attach"); a session whose host drops off shows a card in
its pane — "<host> is offline", the last time it was seen, and a How to
fix fold that points at Settings → Hosts — which turns into "Runner is
back" when it returns. The copy-command buttons, in the console and on a
Settings host card, are icon buttons labelled Copy command / Copied. The
export also put a pasted reference screenshot in `version1/`
(`screenshot-2026-10-01-…png`, a crop of the automations table); it was
left out with the other uploads.

The 2026-10-05 export adds `Tasks`, opened from a third rail item, Plan,
which `SessionsConsole` now carries beside Sessions and Automations. Plan
lists a project's tasks by status — To do, In progress, Later, Done —
with goals above them; a task has a title, notes, a due date and time,
and either starts a session (agent, model, host, repository, prompt) or
links an existing one. A calendar view shows the tasks beside events from
Google Calendar.

The 2026-10-05 evening export adds `PullRequests`, opened from a fourth
rail item, Pull requests, which `SessionsConsole` and `Tasks` now carry
too. It is a review queue: the pull requests waiting on you, searchable
by title, repository, number and author, with what to review next, the
path to merge and median waits; one opens on its brief, files and checks,
the diff with a file tree, line comments and a pending review to submit,
an agent to ask or run a command, conflicts, and Merge behind a confirm.
`version1/assets/filetypes/` holds the file-type marks its file tree uses.
`version1/rail-order.js`, loaded by the three console frames, lets a
person drag the rail's items into their own order, kept per browser.

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
- The 2026-09-24 export also carried a `version2/` canvas (a chat view); it
  is not part of the MVP and was left out, as were `screens/` and
  `screenshots/`. The 2026-09-26 export has no `version2/`.
- Automations (formerly routines) are in the version-1 frames as of the
  2026-09-26 exports, but `../00-scope.md` still lists routines as a
  later slice; that note has not been reconciled with the frames yet.
  Settings is: `../05-screens.md` records it as the one destination
  beside the console, with its routes, the catalog row and the decision
  log in `../README.md` say the same, and `../../../brief.html` follows.
  The Hosts section's backend is `../14-hosts-settings.md`.
- Projects as the frames draw them are in the notes: the project chip,
  the project dialog, the grouped sidebar and Move in `../05-screens.md`,
  the schema in `../10-api-modules-and-data-model.md`.
  One departure from the frames: Move lists every other project rather
  than only those that include the session's repository, because a
  project is metadata and a session may move anywhere (10).
- The console's dialogs — New project and Project settings, Add a host,
  the automation editor — and the onboarding step's copy buttons and
  Inspect fold are in `../05-screens.md` and `../13-automations.md`;
  `SessionsConsole (pages)` and `AddHost (cards)` are the frames they
  replaced, kept for the record. Three departures: Delete project on the
  dialog's footer opens the confirm the inventory draws rather than
  deleting outright; the Inspect fold's panel keeps its own Copy, as
  `CodeBlock`'s panel band has one; and the editor holds its Task step
  alone until the API names a trigger. The workspace-invite email runs
  ahead of the notes, which keep workspaces personal with no invitations;
  the emails are their own slice.
- Plan (`Tasks`, and the rail item and Back to task chip in
  `SessionsConsole`) is in the MVP; its design is `../17-plan.md` to
  `../20-plan-calendar.md`. One departure from the frames there: Google
  Calendar is read-only, so a Google event cannot be edited or dragged.
  Its components are in the design system (the showcase's Plan group),
  and the console builds on them.
- Pull requests (`PullRequests`) are in the version-1 frames as of the
  2026-10-05 evening export, but `../00-scope.md` keeps "Create PR and
  diff view" out of the MVP and `../../../next-steps/0.2-git-and-github.md`
  is where reviewing and merging a pull request from the console lives.
  The rail's drag-to-reorder is in no note either.
- `uploads/` from the export (the raw pasted screenshots) was left out; the
  photography those became lives in `version1/assets/imagery/`.
