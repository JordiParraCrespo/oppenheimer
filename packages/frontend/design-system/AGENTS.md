# design-system — Agent Instructions

Shared design system. This directory is a **container for the publishable
package**, one per platform:

- [`web/`](./web) → `@oppenheimer/design-system-web` — Base UI + Tailwind v4 (used by `apps/web`, `apps/web-showcase`, `packages/frontend/web`)

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first. There is no package.json
> at this level — work inside `web/`.

## The system

The source is the Claude Design export in `product/versions/mvp/design/`:
`_ds/…/tokens/*.css` for the tokens and `readme.md` for the rationale, and
the `version1/` artboards for what the screens actually do. Its one sentence:
**the product is the work, and the design system is the silence around it.**

- **Colour is rationed.** One blue for actions (`--primary`), one for links
  (`--link`). Status hues (green, amber, red) appear only as run state, never
  as decoration and never as a CTA. Everything else is achromatic. One primary
  button per view.
- **Two layers of colour.** The raw palette (`--op-gray-500`, `--op-blue-500`)
  is never referenced in product code. Semantic aliases (`--fg-muted`,
  `--card`, `--border-subtle`) re-point under `.dark` / `[data-theme="dark"]`,
  so a theme switch moves aliases only and no component holds a conditional
  colour. Dark is the version-1 artboards' lifted ramp (`#121213` canvas), not
  the export's true black.
- **One typeface.** The system stack (SF Pro on Apple platforms) does every
  job; Display is the same family at 600 with tighter tracking from 21px up.
  Weight never exceeds 600. Every number a human compares is the system mono
  (SF Mono on Apple platforms), tabular (`figures` utility). Nothing is
  vendored: the fonts are the reader's own.
- **One control ramp**: 28 / 34 / 42px for Button, IconButton, Input, ChipSelect.
- **Six radii and no others**: 6 · 10 · 14 · 18 · 28 · pill. Type into a 10,
  press a pill, read inside an 18.
- **Surfaces never cast shadows.** Depth is tonal. Only popovers, modals and
  glass carry one.
- **Motion** is 80 / 140 / 220 / 400ms, eased, never bouncy; a 4px rise plus
  fade for anything that appears. All durations go to 0 under reduced motion.
- **Copy** is sentence case, verb-first, no emoji. It navigates, it is a
  `Link`; it acts, it is a `Button`.
- **Every scope picker filters.** A `ChipSelect` popup always carries the
  search row and the empty line, even over three options, so the console's
  four chips behave as one thing. It is built on Popover, not Base UI
  Select, for that reason; `RepositorySelect` reuses its parts for the
  multi-repo pane. A foot action with `href` is a new-tab link.
- **Third-party marks are the vendors' own or nothing.** `AgentMark` ships
  Anthropic's Claude mark, the OpenAI mark for Codex, OpenCode's square and
  Grok's slashed circle from their published brand assets, in the vendor's colour where it has one
  and the current ink otherwise. An agent with no published mark takes the
  neutral glyph; never a redrawn imitation.
- **The composer's foot row reads scope of action, then engine.** Left:
  attach and the `PermissionMenu`. Right: `AgentModelSelect` (harness first,
  then its models, so the pair is always valid), `EffortPicker`, mic, send.
  All of them hang from `ComposerToolButton`. Full access is the one setting
  allowed the warning tone, because it can change a machine unattended. On
  New session the composer is tabbed: the scope chips go in its `scope`
  slot, a grey band fused to the top of the field, each chip a
  `ChipSelectTrigger` in its `tab` variant (borderless, muted, no chevron),
  so where the work happens reads as one sentence over the box.
- **The console's chrome is a rail and a grouped sidebar.** `Rail` (56px)
  switches between the sessions and routines lists; the sidebar groups rows
  under `SidebarProjectHeader`s whose actions appear on hover, with
  `SidebarSearch` and the facet chips above the groups and `SidebarEmptyRow`
  inside an empty one. A `SessionItem` takes its ellipsis as `action` and its
  rename as an inline input; both hide the age while they show.
- **A pane, not a submenu, when the pick belongs to the row.** Appearance
  and Language in the account menu, and Move to project… in a row's menu,
  slide the same menu to a pane (`DropdownMenuPaneItem`, then
  `DropdownMenuBack` on top of it), the way the engine button slides to its
  models. `DropdownMenuSub` stays for the filter facets, which are several
  independent picks.
- **A trigger reads as a sentence.** In the routine editor every variable
  part of a trigger is an `InlineToken` in a `TokenSentence` ("Every
  [weekday] at [09:00]"), never a form to decode; mono tokens hold values a
  human compares. `TimeGrid` behind a time token disables past hours rather
  than hiding them, so the grid never reflows. The editor is `RoutineSteps`:
  a finished step inverts its number to a tick and prints its summary.
- **Status glyphs belong to finished things.** The check and alert circles
  appear only in `RunsList`, where each row is a finished run. Live state is
  a `StatusDot` and a word, and `RunHistory` is bars and dots, not a chart.
- **A callout never carries a button, except a failure's one action.**
  `Callout` is a note in the flow on a tonal fill; `neutral` is the default
  and takes no hue; a tinted tone only when something is in that state. The
  action lives in the form. `Alert` is the same box with a title, and a
  failure (`ErrorAlert`) may put its one Dismiss or Retry in `AlertAction`.
- **Copy first, read second.** Add a host is two buttons — Copy install
  command, Copy agent prompt — then the instruction behind a `Disclosure`
  as one `CodeBlock layout="panel"` with Command / Agent prompt tabs on its
  band; the Settings page shows the panel outright. Never two blocks with
  two copy buttons.
- **A fold is a `Disclosure`**: one row that reads as a label, an optional
  word, a summary while closed, a chevron that turns; the panel opens 14px
  under it. Defaults in the project dialog, Inspect in Add a host. Its two
  tones are the only two.
- **A dialog has three widths**, `md`, `form` and `lg`, and a caller never
  sets one.
- **A host that goes away is a phase of the terminal, not an error.**
  `Terminal` takes `hostLink`: the phase (`live`, `reconnecting`, `offline`,
  `catching-up`, `reconnected`), the host's name, and the form. The phase
  table in the package decides what each phase shows; the terminal locks the
  prompt and fades the scrollback itself, and `HostLinkChrome`, in the
  status bar's place, draws the rest. The **banner** is the console's form;
  the **notice** (a card over the scrollback) is the frames' other drawing
  of the same phases, not a second design. The session comes back on its
  own because the runner dials out, so the only control is the fix (How to
  fix), for when it does not. An offline host keeps its place in the host
  picker as a disabled option whose description says so, and the composer's
  `sendBlockedReason` says why send is off.
- **The fix for a machine is a command to copy, not a block to read.**
  `CommandRow` is one `$ command` with an icon copy button (Copy command →
  Copied), stacked in a `CommandRowList`; it is the fix in the host-link
  chrome and in an offline `HostCard`. `CodeBlock` stays for what is read
  before it is copied (the install command and agent prompt). Both copy
  through `useCopy`.
- **Files are dropped on the pane.** `DropZone` wraps New session and a
  running terminal: a drag carrying files lays the 7% action-blue wash over
  the whole pane, edge to edge, with no radius, border or label. It is its
  own box; `listen="window"` only on a page
  with one zone.
- **A sidebar row's actions are its ellipsis.** `SessionItem` and
  `RoutineItem` take `action` and `menuOpen` through one row shell; a
  routine row adds `lastRun`, a dot before the meta for how the last run
  ended, from the same table as `RoutineRun`'s.

## Conventions

- **Tokens are the source of truth**: [`web/src/styles/globals.css`](./web/src/styles/globals.css).
  Palette, semantic aliases, type ladder, space, radii, elevation, motion,
  then the shadcn semantic names aliased onto them, then the Tailwind mapping
  in `@theme inline`. Change the system there; components inherit it.
- Prefer a semantic utility (`text-fg-muted`, `bg-canvas`, `border-border-subtle`,
  `rounded-pill`, `duration-fast`) over a raw value. Never a `dark:` colour
  override: the aliases already invert.
- The previous starter brand's names (`--ink-*`, `--surface-*`, `--status-*`)
  are kept as **legacy aliases** so the unported components in `apps/web`
  still render. Author nothing new against them; they go when the last
  component is ported.
- **The inventory is `web/src/components/`.** Every file there is public, and
  each is named in exactly one item's `components` in the showcase's
  `apps/web-showcase/src/lib/toc.ts`, which is where it is drawn.
  `web/src/internal/` holds what only components import. Nothing else is a
  list: the package's `test` fails when the folder, the barrel and `toc.ts`
  disagree. A component nothing uses is deleted, not kept for later.
- Preview every change in `apps/web-showcase`, in **both** themes; the top
  bar carries the switch.
