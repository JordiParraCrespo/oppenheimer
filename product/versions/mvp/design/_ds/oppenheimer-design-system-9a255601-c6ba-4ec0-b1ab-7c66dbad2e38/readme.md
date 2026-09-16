# Oppenheimer Design System

Oppenheimer is an **AI orchestration platform** — a control plane for running agents across models and tools, watching every step, and stopping a run the moment it drifts. The design system exists so every Oppenheimer surface feels like one product: quiet, dense where it matters, and expensive-looking without a single decorative flourish.

The guiding sentence: **the product is the work, and the design system is the silence around it.**

---

## Sources this system was built from

| Source | What it gave us |
|---|---|
| Brand brief (chat, Sept 2026) | Positioning ("AI orchestration platform"), the "super simple and beautiful" mandate, the required component inventory, dark + light mode requirement |
| Apple (España) — dark style reference (pasted) | Colour rationing (one blue for actions, one for links), pill buttons, 28px surfaces, zero-shadow elevation, negative-tracking display type |
| Apple (España) — light style reference (pasted) | The light theme's `#f5f5f7` canvas / `#ffffff` card pairing, neutral `#e2e2e5` pill, hairline-only division, left-aligned headline rule |
| Paste — style reference (pasted) | The "native OS face as the UI voice" decision, the single ambient shadow for floating layers, section rhythm by surface shift rather than rules |
| `uploads/Screenshot from 2026-09-11 16-25-55.png` | **Layout reference only** — grouped workspace sidebar, status-led session rows, composer-anchored main column |
| `uploads/Screenshot from 2026-09-11 16-27-35.png` | **Layout reference only** — split auth: form column beside a full-height panel |

> The two screenshots are of a third-party product (Anthropic's Claude Code / Claude.ai). They were used **only** to understand information architecture — which regions exist and what they hold. No mark, typeface, colour, illustration or copy from them appears anywhere in this system. Everything visual here derives from the three pasted Apple/Paste style references and the Oppenheimer brief.

No Figma file, repository or codebase was supplied. **If one exists, attach it** — component names, exact paddings and real product copy would all improve.

---

## Index

| Path | What it is |
|---|---|
| `styles.css` | The one file consumers link. Imports everything below. |
| `tokens/` | `fonts · colors · typography · spacing · radii · elevation · motion · base` |
| `assets/fonts/` | SF Pro (variable TTF, roman + italic) and SF Mono (400/500/600 + italic) |
| `components/core/` | Icon, Button, IconButton, Badge, Chip, Card (+Header/Body/Footer), Avatar, Separator, Wordmark, Kbd |
| `components/forms/` | Field, Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch |
| `components/overlays/` | DropdownMenu, Dialog, Tooltip |
| `components/navigation/` | Sidebar (+Header/Scroll/Footer/Section/Item), Tabs, ThemeToggle |
| `components/data/` | Table, StatCard, AreaChart, Sparkline, BarChart, ChartLegend, DonutChart, ProgressBar, EmptyState |
| `components/terminal/` | Terminal, TerminalLine, TerminalTabs, SessionItem |
| `guidelines/` | Foundation specimen cards (Colors, Type, Spacing, Brand) |
| `ui_kits/console/` | The Console recreation: auth → dashboard → run detail. **Not yet reworked** for the terminal-only scope — see the template `console-dashboard` for the current direction. |
| `templates/console-auth/` | Starting template — the sign-in screen |
| `templates/console-dashboard/` | Starting template — app shell, metric tiles, run table |
| `assets/icons/` | 56 Lucide SVGs, the system's complete glyph set |
| `SKILL.md` | Agent-Skills entry point for using this system outside the app |

### Component list

Avatar · AreaChart · BarChart · Badge · Button · Card · CardHeader · CardBody · CardFooter · ChartLegend · Checkbox · Chip · Combobox · Dialog · DonutChart · DropdownMenu · EmptyState · Field · Icon · IconButton · Input · Kbd · ProgressBar · RadioGroup · Select · Separator · SessionItem · Sidebar · SidebarHeader · SidebarScroll · SidebarFooter · SidebarSection · SidebarItem · Sparkline · StatCard · Switch · Table · Tabs · Terminal · TerminalLine · TerminalTabs · Textarea · ThemeToggle · Tooltip · Wordmark

**Intentional additions** (not named in the brief, added because the auth and dashboard surfaces could not be built without them): `Wordmark` (no logo file exists, so the mark needs a component), `Icon` (a wrapper for the glyph set), `Field`, `Card`, `Badge`, `Avatar`, `Separator`, `Kbd`, `Table`, `StatCard`, `ProgressBar`, `EmptyState`, `Dialog`, `Tooltip`, `Tabs`, `ThemeToggle`, `Checkbox`, `RadioGroup`, `Switch`, `Textarea`.

`Terminal`, `TerminalLine`, `TerminalTabs` and `SessionItem` were added when the product's scope was set: Oppenheimer orchestrates **terminal sessions**, so the console is the primary surface rather than a metrics dashboard. They carry their own `--term-*` colour ramp, deliberately separate from the UI ramp, because console output has to stay legible at 13px mono over long sessions on both themes.

---

## Content fundamentals

**Voice: a competent colleague reporting facts.** Oppenheimer runs other people's production work. Copy never celebrates, never apologises at length, and never uses excitement to cover for missing information.

- **Person.** Second person for instructions to the user ("Use your work address"). First-person plural only when the system itself acted ("We sent a six-digit code"). Never first-person singular; the product is not a character.
- **Casing.** Sentence case everywhere — buttons, headers, menu items, table headers, dialog titles. Uppercase is reserved for the 11px eyebrow (section labels in the sidebar, card group labels) and nothing else. Never Title Case A Button Like This.
- **Length.** Buttons are one or two words: *New run*, *Re-queue*, *Stop run*, *Open console*. Descriptions are one sentence that adds a fact the label could not carry — "Workspaces isolate credentials, agents and run history", not "Create a new workspace here".
- **Numbers over adjectives.** "98.2% success rate", "p95 812ms", "6,420 / 10,000 minutes" — never "great performance" or "plenty of headroom". Units are muted and set at 0.55em beside the figure.
- **States are named, not implied.** *Running · Needs input · Failed · Queued · Completed · Idle.* These six strings are the vocabulary; do not invent "In progress" or "Error" alongside them.
- **Destructive copy states the cost.** "Two steps are mid-flight. Completed work is kept; in-flight tool calls are cancelled." Then the button says exactly what it does: *Stop run*, not *Confirm*.
- **Empty states name the next action.** "Pipelines you trigger will appear here with their live step trace." + one button.
- **Nouns are the product's nouns.** Workspace, pipeline, run, step, agent, tool, trigger, trace, quota. Keep them consistent; a "job" is never a "task" two screens later.
- **No emoji. Ever.** Not in UI, not in docs, not in empty states. Status is carried by a coloured dot and a word.
- **Display copy is a statement, not a slogan.** Auth reads *"Every agent, one control plane."* — declarative, full stop, no exclamation. Left-aligned, never centred.

---

## Visual foundations

### Colour

Achromatic by default, with colour **rationed**. One blue for actions (`--primary` #0071e3), one blue for links (#0066cc light / #2997ff dark). Status hues (green/amber/red) appear only as run state — never as decoration, never as a CTA. Chart series get five saturated hues consumed strictly in order. If a new screen seems to need a sixth accent, the screen is wrong.

Every colour is a two-layer token: a raw palette (`--op-gray-500`, `--op-blue-500`) you never reference in product code, and semantic aliases (`--fg-muted`, `--card`, `--border-subtle`) that re-point under `[data-theme="dark"]`. **Theme switching moves aliases only** — no component contains a conditional colour.

- Light: canvas `#f5f5f7`, cards `#ffffff`, text `#1d1d1f`, hairlines `#d2d2d7`.
- Dark: canvas pure `#000000`, cards `#1d1d1f`, sidebar `#0c0c0d`, text `#f5f5f7`, hairlines `#39393d`.
- Dark mode is **true black**, not dark grey. The canvas is a void; cards are the only lit surfaces.

### Type

**One typeface.** There is no serif, no separate display face, no second family — SF Pro does every job, and size plus tracking carry the hierarchy. This is the discipline all three reference systems run on, and it is why the product reads as one surface rather than a themed one.

- **SF Pro** (`SF Pro Text` / `SF Pro Display`, variable TTFs) — everything a user operates. `--font-display` is the same family at weight 600 with tighter tracking, used only at 34px and above. **Weight never exceeds 600**; 700 reads as panic against this tracking.
- **SF Mono** with tabular figures — every number a human compares: metrics, latency, cost, run IDs, quota counts. Never for prose.

Tracking follows the inverse-size rule: −0.032em on the wordmark, −0.024em at 38–52px, −0.011em at 15px, +0.02em at the 11px uppercase eyebrow. Size ladder: 76 / 52 display; 40 / 28 / 21 / 17 headings; 17 lead, 15 read, 14 operate, 13 support, 12 annotate, 11 eyebrow.

### Space and shape

4px base. Product UI lives between 4 and 24; 40–80 is page rhythm. Controls share **one height ramp** — 28 / 34 / 42px — so a Button, an Input and a Select sit on a row without adjustment.

Six radii exist and no others: **6px** (swatches, inline code) · **10px** (anything you type into) · **14px** (menus, popovers) · **18px** (cards) · **28px** (modals, hero surfaces) · **980px** (anything you press). The rule reads simply: *type into a 10, press a pill, read inside an 18.*

### Elevation

**Surfaces never cast shadows.** Depth is tonal: a `#ffffff` card on an `#f5f5f7` canvas, a `#1d1d1f` card on black. Only three transient layers carry a shadow, and all are soft and ambient rather than directional — popovers/menus (`--shadow-popover`), modals (`--shadow-modal`), and glass (`--glass` + 20px blur) for anything floating over media. A drop shadow on a card is the fastest way to make this system look cheap.

### Borders and dividers

Hairlines only, 1px, `--border-subtle` inside components and `--border` on interactive outlines. Sections divide by **surface shift and whitespace**, not by rules — if you find yourself drawing a line to separate two blocks, add 24px instead.

### Backgrounds and imagery

Flat fills. **No gradients** on text, buttons, cards or sections. No textures, no patterns, no mesh, no glow. The system ships **no photography and no illustration**, and none should be invented: where a marketing layout wants an image, use a flat tonal panel with a serif statement (see the auth screen) until real photography exists. If photography is added later, follow the reference systems: product-on-void, dramatic side light, no lifestyle staging, cool neutral grade.

### Motion

Short, eased, never bouncy — nothing springs, nothing overshoots. 80ms hover/press · 140ms menus and tooltips · 220ms dialogs, sidebar collapse, theme change · 400ms progress and chart fills. `cubic-bezier(.4,0,.2,1)` standard, `cubic-bezier(.16,1,.3,1)` on entry. Menus and dialogs enter with a 4px rise plus fade; nothing slides in from an edge. All durations collapse to 0 under `prefers-reduced-motion`.

### Interaction states

- **Hover** — a translucent wash (`--hover-surface`, black/white at 4–6%) on ghost and list items; filled controls step to a slightly lighter tone (`--control-hover`, `--primary-hover`). Never a colour change of hue.
- **Press** — `scale(.975)` on buttons plus a darker fill. 80ms. No ripple.
- **Focus** — a 3px `--ring` halo plus a blue border on fields; a 2px offset outline elsewhere. Focus is always visible; never `outline: none` without a replacement.
- **Selected** — the blue tint (`--selected-surface`), never a border colour change alone.
- **Disabled** — 40–50% opacity and pointer-events off. Disabled controls keep their shape; they never turn grey-on-grey.

### Transparency and blur

Used in exactly two places: the modal scrim (`--overlay`, plus a 3px backdrop blur) and `--glass` for a control floating over media. Everywhere else, surfaces are opaque. Blur is never decorative.

### Layout rules

Fixed sidebar (264px, 60px collapsed) with its own surface tier; fixed 56px top bar carrying breadcrumb + title, search, and the theme toggle; the main column scrolls alone. Dashboard content caps at 1400px and sits on the canvas tier with 24px padding and a 12px grid gutter. Marketing and auth cap at 1280px. Headlines are **left-aligned, never centred**.

---

## Iconography

**Lucide** (ISC licence), 24px grid, 2px stroke, round caps and joins. The 56 glyphs actually used are vendored into `assets/icons/` as SVG and mirrored inside `components/core/Icon.jsx`, so the set works offline with no CDN.

- Always `<Icon name="…" size={16} />` — never paste raw SVG into a screen, never hand-draw one.
- Icons inherit `currentColor` and are **never given their own colour**; colour the text around them instead.
- Sizes: 13px in small controls, 15–16px standard, 18–20px in empty states. Stroke stays at 2 at every size.
- **No emoji, anywhere.** Unicode symbols appear only as keyboard glyphs inside `<Kbd>` (⌘, ⌥, ⏎) and as the `·` separator in metadata rows.
- There is no icon font and no sprite sheet. If a needed glyph is missing, take it from Lucide, add it to `assets/icons/` and to the `ICONS` map in the same commit — do not substitute a different family.
- **Status is a dot, not an icon.** Run state is a 6–7px coloured dot plus a word; reserve `check-circle` / `alert-triangle` for step-level detail and empty states.

### Logo

**No logotype file was supplied, and none was invented.** The `Wordmark` component sets the name "Oppenheimer" in SF Pro Display 600 at −0.032em — that is the mark. If a real logo exists, drop the SVG into `assets/` and swap the inside of `Wordmark.jsx`; nothing else needs to change.

---

## Fonts

| Role | Family | Source |
|---|---|---|
| UI sans | **SF Pro Text / SF Pro Display** | Supplied by the team as variable TTFs, vendored to `assets/fonts/` and declared with `@font-face` in `tokens/fonts.css`. Weights 100–900, roman + italic. |
| Mono | **SF Mono** | Regular / Medium / Semibold + roman italic OTFs from [supercomputra/SF-Mono-Font](https://github.com/supercomputra/SF-Mono-Font), vendored to `assets/fonts/`. |

Both families ship as local files. **There are no remote font requests and no substitutions.** A display serif (Newsreader) was trialled and removed — the brief specified no second typeface, and none of the three reference systems uses one.

Third-party brand glyphs live in `assets/brand/` and are the only non-Lucide marks in the system, used solely on the auth buttons. Google ships as the **full-colour** four-colour G ([devicon](https://github.com/devicons/devicon), MIT) — a third party's colour is their identity, not our accent, so it is the one sanctioned exception to chroma rationing. GitHub is monochrome ([simple-icons](https://github.com/simple-icons/simple-icons), CC0) and flips for dark mode via `--brand-glyph-filter`, which is that brand's own rule.

---

## Rules that are non-negotiable

1. One `primary` button per view. The blue is rationed; a second chromatic CTA breaks the system.
2. No box-shadow on any surface. Only menus, modals and glass.
3. Font-weight never exceeds 600.
4. No gradients, anywhere, on anything.
5. Only the six radii. If your value is not in that list, it is wrong.
6. Every number a human compares is mono and tabular.
7. Status colour means status. Never decoration.
8. Sentence case everywhere except the 11px uppercase eyebrow.
9. No emoji, no hand-drawn SVG, no invented imagery.
10. Dark mode is true black; light mode's canvas is `#f5f5f7`, not white.
