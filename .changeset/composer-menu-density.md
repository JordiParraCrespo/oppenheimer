---
"@oppenheimer/design-system-web": minor
---

Give `ChipSelect`'s parts and `DropdownMenuRadioItem` a density, so the
composer's two menus are a shape the components own rather than measurements
restated at each call site: `ChipSelectPopup`, `ChipSelectItem`,
`ChipSelectSearch` and `ChipSelectBack` take `density="menu"` for the engine
pane, and `DropdownMenuRadioItem` takes `density="compact"` for the permission
menu. New `ChipSelectList` is one pane body — rows, the loading line, or the
empty one — and caps itself in rows of its density; `ChipSelectEmpty` takes
`live` for a list still being read, and `ChipSelectItem` takes `trailing` for a
row that ends in something other than a check. `ChipSelect` and
`RepositorySelect` take `loading`, and `RepositorySelect` a separate
`branchesLoading` for its branch pane.
