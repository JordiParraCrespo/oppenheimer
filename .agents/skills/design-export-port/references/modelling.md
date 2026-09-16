# Modelling rules and recurring traps

Product-invariant. No pixel values, no product component names.

## Modelling

- **Navigate vs act.** An element that goes somewhere is a link; one that
  does something is a button. Separate components; neither dresses as the
  other. A primary action that also routes is the one crossover, via
  `render`.
- **A trigger that opens a list of values is a select**, whatever it looks
  like. Reach for the picker `frontend-ui.md` names for that case before
  inventing one. A row that acts instead of choosing ("Add…") is an action
  item, separated, never the value.
- **Behaviour that would repeat on every screen lives in one component**:
  a password reveal, a copy-to-clipboard, an autoplay. Screens never
  re-implement it.
- **Menus that share parts are one menu component** with those parts
  (header line, right-aligned value, description on an item, submenu,
  destructive item), not one component per menu.
- **Status vocabulary is the export's.** Do not add states; do not turn a
  dot into an icon or an icon into a dot.
- **Third-party marks are a component**; icons come from the set the
  system names, never pasted SVG.
- **A live engine ships as its frame** (surface, chrome, a static line
  vocabulary for the showcase); the engine is wired in the app.
- **Drop what the screens do not use**, even if the export lists it.

## Base UI and Tailwind v4 traps

- `useRender` with `props` typed as a bare object fails the
  `Record<string, unknown>` constraint; wrap with `mergeProps<'a'>(…)`.
- Base UI `Button` rendering an anchor needs
  `nativeButton={nativeButton ?? render === undefined}`.
- Base UI `Select` with a non-field trigger: `alignItemWithTrigger={false}`
  and `min-w-(--anchor-width)` so it drops like a menu; `data-popup-open:`
  carries the open state on the trigger.
- Base UI `Menu` submenus are `SubmenuRoot` + `SubmenuTrigger`; entry
  motion goes on `data-starting-style` / `data-ending-style`.
- A read-only chip must be a `span`, not a button; branch on `onClick`.
- A field with slots: a flex shell around the native input; `ref` and
  input props go to the inner element, `className` styles the shell, focus
  via `has-focus-visible:`, invalid via `has-aria-invalid:`.
- A Next page that renders demos with handlers must be `'use client'`;
  a server component cannot pass functions to client children.
- A side-by-side theme demo is a `.dark` scoped div next to a plain one;
  everything reading tokens re-themes through the aliases.
