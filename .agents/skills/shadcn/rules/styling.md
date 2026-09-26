# Styling & Customization

See [customization.md](../customization.md) for theming, CSS variables, and adding custom colors.

## Contents

- Brand colour tokens
- Built-in variants first
- className for layout only
- No space-x-* / space-y-*
- Prefer size-* over w-* h-* when equal
- Prefer truncate shorthand
- No manual dark: color overrides
- Use cn() for conditional classes
- No manual z-index on overlay components

---

## Brand colour tokens

Colours are the brand primitives from `packages/frontend/design-system/web/src/styles/globals.css`:
`text-ink-900/600/400`, `bg-surface-*`, `border-border-*`, `--accent-*`,
`--status-*`. Not raw Tailwind colours, and not shadcn's semantic aliases
(`text-muted-foreground`, `bg-muted`, `text-foreground`) even though they
resolve to the same values. The full vocabulary is `.agents/rules/frontend-ui.md`.

**Incorrect:**

```tsx
<div className="bg-blue-500 text-white">
  <p className="text-gray-600">Secondary text</p>
  <p className="text-muted-foreground">Also secondary</p>
</div>
```

**Correct:**

```tsx
<div className="bg-surface-card text-ink-900">
  <p className="text-ink-600">Secondary text</p>
</div>
```

---

## No raw color values for status/state indicators

For positive, negative, or status indicators, use Badge variants or the `--status-*` tokens — don't reach for raw Tailwind colors.

**Incorrect:**

```tsx
<span className="text-emerald-600">+20.1%</span>
<span className="text-green-500">Active</span>
<span className="text-red-600">-3.2%</span>
```

**Correct:**

```tsx
<Badge variant="neutral">+20.1%</Badge>
<Badge variant="active">Active</Badge>
<Badge variant="paused">-3.2%</Badge>
```

A colour genuinely outside the palette becomes a named token in `globals.css` with a comment saying why.

---

## Built-in variants first

**Incorrect:**

```tsx
<Button className="border border-input bg-transparent hover:bg-accent">
  Click me
</Button>
```

**Correct:**

```tsx
<Button variant="outline">Click me</Button>
```

---

## className for layout only

Use `className` for layout (e.g. `max-w-md`, `mx-auto`, `mt-4`), **not** for overriding component colors or typography. To change colors, use built-in variants or the brand tokens.

**Incorrect:**

```tsx
<Card className="bg-blue-100 text-blue-900 font-bold">
  <CardContent>Dashboard</CardContent>
</Card>
```

**Correct:**

```tsx
<Card className="max-w-md mx-auto">
  <CardContent>Dashboard</CardContent>
</Card>
```

To customize a component's appearance, prefer these approaches in order:
1. **Built-in variants** — `variant="outline"`, `variant="destructive"`, etc.
2. **Brand colour tokens** — `text-ink-*`, `bg-surface-*`, `--status-*`.
3. **A new named token** in `globals.css`, with a comment saying why.

---

## No space-x-* / space-y-*

Use `gap-*` instead. `space-y-4` → `flex flex-col gap-4`. `space-x-2` → `flex gap-2`.

```tsx
<div className="flex flex-col gap-4">
  <Input />
  <Input />
  <Button>Submit</Button>
</div>
```

---

## Prefer size-* over w-* h-* when equal

`size-10` not `w-10 h-10`. Applies to icons, avatars, skeletons, etc.

---

## Prefer truncate shorthand

`truncate` not `overflow-hidden text-ellipsis whitespace-nowrap`.

---

## No manual dark: color overrides

The brand tokens already invert with the theme. `bg-surface-canvas text-ink-900` not `bg-white dark:bg-gray-950`. Only a design-system primitive that switches something other than a colour (a blend mode, a chart theme) uses `dark:`.

---

## Use cn() for conditional classes

Use the `cn()` utility from the project for conditional or merged class names. Don't write manual ternaries in className strings.

**Incorrect:**

```tsx
<div className={`flex items-center ${isActive ? "text-ink-900" : "text-ink-400"}`}>
```

**Correct:**

```tsx
import { cn } from "@/lib/utils"

<div className={cn("flex items-center", isActive ? "text-ink-900" : "text-ink-400")}>
```

---

## No manual z-index on overlay components

`Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `DropdownMenu`, `Popover`, `Tooltip`, `HoverCard` handle their own stacking. Never add `z-50` or `z-[999]`.
