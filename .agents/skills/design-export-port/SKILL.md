---
name: design-export-port
description: Port a Claude Design export (a design system plus screen artboards) into packages/design-system/web and rebuild apps/web-showcase around it. Use this whenever the user says they uploaded or exported designs, wants the design system, tokens, colours, foundations, or showcase built or updated from a design, asks to "set up the design system" from a design folder, or wants the components a set of screens need — even if they only mention colours or foundations at first. Covers reading the export, rendering the artboards, reviewing them page by page to derive the component inventory, porting tokens and fonts, building the components on Base UI, rebuilding the showcase, docs, verification and the PR.
---

# Port a design export into the design system

A Claude Design export is two things: a **design system** (tokens as CSS,
a readme with the rationale, per-family component CSS) and a set of
**artboards** (`*.dc.html` screens that run on that system, often with a
small override file on top). This skill turns that into
`packages/design-system/web` (tokens, fonts, components) and
`apps/web-showcase` (the rendered reference), the way the MVP port was done.

The export is the spec, but the artboards are the truth: where they
override the system (a dark ramp, a sidebar surface), the artboards win,
because they are what the user approved. Write that decision down.

## 0. Before writing anything: plan, then confirm

The user usually asks for less than the job needs ("just the colours and the
foundations") and then widens it once they see the screens. Read everything
first, write a short plan, and ask the two or three questions that change
the work. Do not start the port from the first message.

Questions that always matter:

- Which ramp: the export's tokens or the artboards' override (dark canvas
  true black vs lifted)?
- Which components: only what the screens use (the default), or the
  export's full list?
- What happens to the previous components the apps still import: delete
  (breaks the app until its screens are rebuilt) or keep as legacy aliases
  (recommended, keeps CI green)?

## 1. Find and read the export

Look under `product/` for a folder holding `_ds/<system-id>/` and
`<version>/` with `.dc.html` files (in Oppenheimer:
`product/versions/mvp/design/`). Read, in this order:

1. `_ds/<id>/readme.md` — the rules. The colour rationing, type ladder,
   radii, elevation, motion and copy rules become the doc you write later.
2. `_ds/<id>/tokens/*.css` — `colors`, `typography`, `fonts`, `spacing`,
   `radii`, `elevation`, `motion`, `base`. This is the token file's source.
3. `<version>/ds-base.js` or similar — the artboards' overrides. Anything
   here supersedes the tokens.
4. `_ds/<id>/components/*/*.css` — exact measurements per component (heights,
   paddings, radii, states). Read the family you are about to build, not all
   of it up front.
5. `<version>/*.dc.html` — the screens. `Flow` or an index page lists them
   in order; a `Components` page is the export's own inventory.

Also read the repo side: the current `globals.css`, the package README and
`packages/design-system/AGENTS.md`, and which components `apps/web` imports
from the package (root and subpath), so you know what must keep compiling.

## 2. Render the artboards

The `.dc.html` pages need their runtime (React from unpkg, served over
HTTP, not `file://`). `scripts/render-artboards.mjs` handles this: it serves
the design folder, routes the CDN scripts to vendored copies, and
screenshots every page in light and dark, plus named interactions (open a
select, a menu, close a modal). Run it once, then look at every image
yourself before showing the user.

```bash
node .agents/skills/design-export-port/scripts/render-artboards.mjs \
  --design product/versions/mvp/design --version version1 --out /tmp/shots
```

If the runtime cannot load, the page is blank white: check the console
errors the script prints (TLS through a proxy, `file://` fetch) rather than
assuming the artboard is empty.

## 3. Review page by page, with the user

Walk the screens **one per turn**, in flow order, and wait for the user
before moving on. Send the light and dark screenshot, then list only what
is new on that page. For each page:

- grep the artboard for the system's class prefix (`op-*` in the export) to
  see which components it really uses; the `x-import` components are the
  minority, most of the screen is those classes;
- read the markup for hidden states (`sc-if`, timers): connected vs
  pending, a modal that opens on load, a filter that appears after a click.
  Capture those states too; they are where components get their variants;
- name each element with the system's vocabulary and say how you will model
  it. The user will correct the model ("that's a select, no?", "that's a
  carousel"). Those corrections are the inventory, so ask when unsure.

Modelling rules that came out of the MVP review, keep them:

- **It navigates, it is a `Link`; it acts, it is a `Button`.** A Button
  never dresses as a link; a Link never gets control height. The one
  crossover is a step's primary action that also routes (`render`).
- A chip that opens a list of values is a **`ChipSelect`** (a Select whose
  trigger is a chip), not a Dropdown. An action row in it ("Add a host…")
  is an `Action`, sits after a hairline, never takes the check.
- Show/hide on a password field lives in **one** `PasswordInput`, never in
  screens. Input gets `leading`/`trailing` slots and PasswordInput is Input
  with a prewired trailing toggle.
- Status is a dot and a word (`StatusDot`), never an icon; `completed`
  may be a check. The states are the export's vocabulary; do not invent.
- A dismissable summary of an active filter is a `FilterChip`, a chosen
  value or capability is a `Chip`.
- Menus that share parts (filters with values, an account menu with a
  header and a destructive item, a model picker with two-line options) are
  **one** `DropdownMenu` with those parts, not three components.
- A brand mark on a button is a `BrandGlyph`, never pasted SVG; a bare "×"
  glyph becomes the Lucide `x` in an `IconButton`.
- Photography that cross-fades with captions and dots is an
  `ImageCarousel` with autoplay, pause on hover, off under reduced motion.
- The terminal ships as a **frame** (surface, prompt row, status bar,
  `TerminalLine` vocabulary for replays); the live scrollback is xterm.js
  in the product.
- Drop what the screens do not use, even if the export lists it
  (ThemeToggle became a menu row; Tabs, Table, Charts never appeared).

Close the walk with the final inventory grouped the way the export groups
(core, forms, overlays, navigation, terminal, media) and the open decisions
answered. Only then build.

## 4. Tokens: `packages/design-system/web/src/styles/globals.css`

One file, this order, each block commented with why:

1. `@font-face` for the self-hosted faces (see §5).
2. `@layer base { :root { … } }`:
   - **layer 1**, the raw palette (`--op-*`), never referenced in product
     code;
   - **layer 2**, the semantic aliases in the export's own names
     (`--canvas`, `--fg-muted`, `--border-subtle`, `--control*`, `--field*`,
     `--primary*`, `--link`, `--ring`, status + surfaces, `--sidebar*`,
     `--chart-*`, `--term-*`, shadows, glass), with the artboard overrides
     applied;
   - typography (families, weights, size/leading/tracking triplets), space,
     the control height ramp, radii, motion;
   - the **shadcn semantic names** aliased onto layer 2 (`--foreground`,
     `--muted`, `--accent`, `--destructive`, `--input`, `--sidebar-*`), so
     the component library inherits the system without edits;
   - the **previous brand's names as legacy aliases**, in a clearly marked
     block, if the apps still import unported components. Author nothing
     new against them.
3. `.dark, [data-theme="dark"] { … }` restating only what changes, plus the
   legacy names that are not pure aliases. Both selectors: `.dark` is the
   Tailwind convention, `data-theme` is what the export's pages set.
4. `@media (prefers-reduced-motion: reduce)` zeroing the durations.
5. `@theme inline` mapping tokens to Tailwind utilities: fonts, the type
   ladder with paired `--text-*--line-height` and `--letter-spacing`
   (expose both Tailwind names and the export's names), weights (`bold`
   maps to the ceiling, 600), tracking, the radii (only the export's, alias
   `2xl`+ to the largest), shadows (`sm`/`md` are `none`; only popover and
   modal exist), durations, and every colour as `--color-*` including the
   legacy set.
6. The base layer: visible `:focus-visible` (the export requires it even if
   the previous system suppressed it), body voice, headings at the ceiling
   weight, `a` in link blue, code in mono with tabular figures, selection.
7. Utilities the export implies: `figures` (mono, tabular), `eyebrow` (the
   11px uppercase label), `glass`, `scrollbar-thin`.

Keep the previous `tailwind.config.ts` preset in sync with the same values;
it is the JS mirror for consumers not on Tailwind v4.

## 5. Fonts

The export ships the vendor files (a 6MB variable TTF is normal). Ship
subsets instead: `scripts/build-fonts.py` instances a variable font at the
weights and optical sizes the system uses, subsets to Latin plus the
punctuation and keyboard glyphs the UI renders, and writes woff2 of about
30KB a face. Edit the table at the top for the families; it needs
`fonttools` and `brotli` (`pip install fonttools brotli`).

Ship only the weights the system allows (400/500/600 when 600 is the
ceiling) and skip italics unless a screen uses one.

## 6. Components

Conventions, all of them already in the package:

- One file per component in `src/components/`, Base UI primitives, `cva`
  for variants, `cn()` for classes, `data-slot` on the root, `render` for
  element swapping. Copy the exact numbers from the export's component CSS:
  heights from the control ramp, paddings, radii, the ring, the transition.
- Every file gets a `./name` subpath in `package.json` `exports` and every
  export lands in `src/index.ts`; `pnpm --filter <pkg> test` fails
  otherwise. Types too.
- When a file already exists with the same name (Button, Dialog, Sidebar…),
  **rewrite it in place and keep the exports the apps import**. Add the
  old variant and size names as marked legacy aliases in the `cva` table so
  callers type-check; keep old subcomponents (`DialogHero`) as thin,
  system-compliant wrappers rather than deleting them.
- Prefer restyling the shadcn `Sidebar` over writing a new one: it carries
  the provider, collapse and mobile behaviour the showcase shell relies on.
- Images go in `src/assets/` as WebP (`scripts/build-fonts.py` has the
  Pillow recipe in a comment), exported as `./assets/*`.

`references/component-recipes.md` has the per-component notes from the MVP
port (props, states, the trap each one had). Read the entry before writing
that component.

## 7. Showcase: `apps/web-showcase`

The showcase is the rendered reference and the inventory's table of
contents. Rebuild rather than patch:

- `src/lib/toc.ts` lists the inventory in the export's grouping; the
  sidebar and the scroll-spy read it, and `TOC_COUNT` is the component
  count on the sidebar header.
- `src/app/page.tsx` renders foundations first (palette, semantic colours
  **in both themes side by side** through `ThemePair`, the type ladder with
  size/leading/tracking, space and the control ramp, radii, elevation,
  motion, icons), then one `<Spec id>` per component showing every state
  the screens use, with a usage line. Mark it `'use client'`: demos hold
  state, and a server component cannot pass handlers.
- Interactive demos (menus, dialog, chip selects, composer, the sidebar
  mock in both themes and empty, the terminal in both themes, the carousel)
  live in `src/components/demos.tsx`; foundations in `foundations.tsx`.
- Delete the previous inventory's demo files; the old system should not be
  browsable next to the new one.
- Copy the package's imagery into `public/imagery/` for the carousel demo.

Then build it and screenshot it: `scripts/shoot-showcase.mjs` starts the
built app, captures the top and each named section in light and dark, and
prints console errors. Look at the images; that is the review.

## 8. Docs

Update, in the same PR:

- `packages/design-system/AGENTS.md`: the rules from the export's readme,
  the token conventions, the legacy-alias note, the "inventory is the
  showcase's TOC" rule, the mobile package's status.
- `packages/design-system/web/README.md`: what is inside, the CSS wiring,
  the inventory by family.
- `apps/web-showcase/CLAUDE.md`: the file layout and the "Spec + TOC row"
  rule.
- The design folder's README: replace "not yet ported" with where it went
  and which ramp was chosen.
- The root `CLAUDE.md` design-system section, if the rules it states changed.

## 9. Verify before pushing

- `tsc --noEmit` in the package, the showcase, and every app that imports
  the package (`apps/web`); filter the app's output to errors mentioning
  the design system, since unbuilt workspace packages produce noise.
- `node packages/design-system/web/scripts/check-exports.mjs`.
- `next build` in the showcase, then the screenshot script.
- `pnpm starter:check` still passes (the design export is skipped by
  `scripts/starter/prune.mjs`; keep it that way).

Biome ignores the showcase and the components folder by config; that is
not a green light, it is just not a gate.

## 10. Ship

One PR with a clear body: tokens, fonts, the inventory by family, what
stayed legacy and why, the showcase, the docs, the verification list, the
out-of-scope list (porting the app's screens, mobile tokens, removing the
legacy components). Then rebuild the app's screens on the new components
as the next slice, starting with the flow the artboards start with.
