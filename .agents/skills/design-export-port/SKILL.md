---
name: design-export-port
description: Port a design export (a design system as tokens plus screen artboards, from Claude Design or a similar tool) onto this repo's web design system and rebuild the web showcase from it. Use this whenever the user says they uploaded or exported designs, wants the design system, tokens, colours, typography, foundations or showcase built or updated from a design, asks to "set up the design system" from a design folder, or wants the components a set of screens need — even if they only mention colours or foundations at first. Covers reading the export, rendering the artboards, reviewing them page by page to derive the component inventory, porting tokens, building components on Base UI, rebuilding the showcase, docs, verification and the PR.
---

# Port a design export onto the design system

A design export is two things: a **design system** (tokens, a readme with
the rationale, usually per-component CSS) and **artboards** (screens that
run on that system, often with a small override layer). The job is to make
`packages/frontend/design-system/web` and `apps/web-showcase` say what the export
says, on this repo's conventions.

This skill is the invariant workflow. It does not know which brand, face,
palette or component names the export carries; the repo's own documents do
the deciding on vocabulary, and the export decides values:

- `packages/frontend/design-system/AGENTS.md` — the token vocabulary and the rules
  the package already documents. Port **onto** it; do not replace it
  without a decision recorded in the plan.
- `.agents/rules/frontend-ui.md` — which component to reach for (the
  picker table, colour vocabulary, where files live). Do not add a
  parallel rule.
- `packages/frontend/design-system/web/src/styles/globals.css` — the token file.

The export is the spec, but the artboards are the truth: where they
override the system, the artboards win, because they are what the user
approved. Write that decision down in the token file.

## 0. Plan, then confirm

Users ask for less than the job needs ("just the colours") and widen it
once they see the screens. Read everything, write a short plan, and ask
the questions that change the work before writing a line:

1. Where the artboards override the tokens, which value wins?
2. Inventory: only what the screens use (the default) or the export's
   full component list?
3. Vocabulary: does the export's semantic naming replace the package's, as
   a mechanical rename in the same PR, or map onto it? One vocabulary
   leaves the PR, never two.
4. Callers: which apps import which components, and what happens to the
   ones the screens no longer need (keep compiling, or rebuild the
   screens first)?

## 1. Read the export

Find the export root the user points at (ask if unsure). Read in order:

1. the system readme — rules that become the docs in §8;
2. the token files — colour, type, spacing, radii, elevation, motion;
3. any override the artboards load on top — it supersedes the tokens;
4. the component CSS for a family only when you build that family;
5. the artboards; an index page gives the order, a "components" page is
   the export's own inventory (a hint, not the target).

Then the repo side: `globals.css`, the package README and AGENTS.md, the
frontend rule, and every import of the package from the apps (`apps/web`
imports the package root; the showcase imports subpaths). Note the web /
mobile mirror: a variant added on web needs its mobile counterpart or a
note in the PR saying why not.

## 2. Render the artboards

Artboards are HTML that needs a runtime and an HTTP origin.
`scripts/render-artboards.mjs` serves the export, vendors any CDN scripts
the pages load, and screenshots every page light and dark, with optional
clicks per page and an escape for on-load modals. It exits non-zero when a
page throws, so a blank capture is never silent.

```bash
node .agents/skills/design-export-port/scripts/render-artboards.mjs \
  --design <export root> --version <artboards dir> --out /tmp/shots \
  [--only SignIn,AddHost] [--click SignIn:.some-trigger] [--escape]
```

## 3. Review page by page, with the user

Walk the screens **one per turn**, in flow order, and wait before moving
on. Send the light and dark capture, then list only what is new on that
page:

- find the export's class prefix in the markup and grep for it: that is
  what the screen really uses;
- read the markup for hidden states (conditionals, timers): pending vs
  done, a modal that opens on load, a menu after a click. Capture those;
  they are where variants come from;
- for each element, name the component **this repo already has** for it
  (per `frontend-ui.md`), or say why none fits. The user will correct the
  model; those corrections are the inventory.

Modelling rules that hold regardless of product are in
`references/modelling.md`. Close the walk with the inventory grouped the
way the export groups its families and every open decision answered.
Only then build.

## 4. Tokens

`globals.css` carries **one semantic layer** and the shadcn names mapped
onto it. Structure:

1. `@layer base { :root { … } }` — the semantic tokens in the agreed
   vocabulary, with the artboard overrides applied and commented; then the
   shadcn names (`--background`, `--foreground`, `--muted`, `--accent`,
   `--destructive`, `--input`, `--ring`, `--sidebar-*`) aliased onto them.
   A raw palette may exist above the semantic layer only if the export
   defines one; product code never references it.
2. `.dark, [data-theme="dark"]` restates aliases only. No component holds
   a conditional colour.
3. `@theme inline` registers what utilities need: colours as `--color-*`,
   fonts, the type ladder once (one name per size, with paired line-height
   and letter-spacing), space and control heights if the system has a
   ramp, exactly the export's radii, shadows (forbidden ones map to
   `none`), durations.
4. The base layer states focus, body voice, heading weight, link colour as
   the export's readme says; if the repo's documented rule differs, the
   plan decides and the doc changes in the same PR.

Do not add a second dialect of the same tokens (old names next to new)
unless renaming callers is genuinely larger than the port; if you must,
mark the block, list what still reads it, and open the follow-up.

Fonts are **system stacks** in `--font-sans` / `--font-display` /
`--font-mono`. No `@font-face`, no files in the package, unless the export
ships a face whose licence permits redistribution and the user confirms
it; then subset it in that PR, against that face.

Keep the JS `tailwind.config.ts` preset in sync with the same values.

## 5. Components

- One file per component, Base UI primitives, `cva` variants, `cn()`,
  `data-slot` on the root, `render` for element swapping. Copy measurements
  from the export's component CSS, not from the screenshot.
- Every file has a `./name` subpath in `package.json` and every export,
  types included, is in `src/index.ts`; the package's `test` fails
  otherwise.
- Existing component with the same role: **rewrite in place** and keep the
  exports callers still use. Add previous variant names only for callers
  that exist; delete what nothing imports.
- Mirror the API change in the mobile package or record why not.
- Restyle the shadcn `Sidebar` rather than replacing it; the showcase
  shell uses its provider and mobile sheet.

`references/modelling.md` also lists the Base UI traps that recur (typing
`useRender` props, `nativeButton` when rendering an anchor, Select
positioning).

## 6. Showcase

`apps/web-showcase` is the rendered reference and the inventory's table
of contents. Its `src/lib/toc.ts` lists the inventory in the export's
grouping; each entry is a `<Spec id>` on the page showing every state the
screens use, with a usage line; foundations come first, colours in both
themes side by side. Keep the showcase's existing demo files where they
still show a component the inventory keeps; replace the ones that show
what was dropped. Pages that hold state are client components.

Build, then `scripts/shoot-showcase.mjs` starts the built app, captures
the top and the section ids you name in light and dark, applies both theme
selectors, and exits non-zero on console errors or a server that never
answers.

## 7. Verify

- `tsc --noEmit` in the package, the showcase, and every app importing
  the package (filter to errors naming the package).
- The package's export check.
- `next build` in the showcase, then the shooter.
- `pnpm starter:check`: anything in this skill or the export that names an
  optional app is listed under that app's feature in
  `scripts/starter/features.json`; if the repo tracks the export as a
  design record, the manifest check skips it.

## 8. Docs, in the same PR

`packages/frontend/design-system/AGENTS.md` (rules and vocabulary as now agreed),
the package README (what is inside), `apps/web-showcase/CLAUDE.md`, the
export's own README (where it went, which overrides won), and the root
agent notes if a stated rule changed.

## 9. Ship

One PR: tokens, the inventory by family, what was dropped and why, the
showcase, docs, the verification list, the out-of-scope list. Append a
dated note to `references/` with what this export needed that the
workflow did not predict, labelled as not to be replayed.
