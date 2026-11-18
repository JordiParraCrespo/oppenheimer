---
'@oppenheimer/design-system-web': minor
'@oppenheimer/web': minor
---

Every picker with a search is picked from the keyboard the same way. `ChipSelectCombobox` (Base UI Combobox, inline in the popup) wraps a pane's search, list and rows: ↑ and ↓ move the highlight while the focus stays in the search, Enter takes the highlighted row, and the field names it to a screen reader through `aria-activedescendant`. `ChipSelect`, `RepositorySelect` (both panes), `FieldSelect`, `RepositoryAddField`, `RepositoryRowList`, `SearchList` and the engine button use it, and so do the console's host chip, bots menu, Link existing and watched-repository search, which drop their own highlight state and key handlers. `ChipSelectItem` loses its `highlighted` prop: the combobox owns the highlight.
