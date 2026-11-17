---
'@oppenheimer/design-system-web': minor
'@oppenheimer/web': minor
---

The folder chip's path field walks its folders from the keyboard: ↑ and ↓ light the recent, listed and found folders, Enter opens the lit one as a click does, and with none lit Enter still uses the folder typed. Opening a folder clears the light, so Enter then uses it. `ChipSelectSearch` takes an `icon` in place of the magnifier and a `trailing` note, which the path field uses for its folder glyph and the host's home.

`ChipSelectCombobox` no longer takes `loading` or remounts when its rows land, which moved the caret and dropped IME text mid-typing; Enter with nothing lit takes the first row in a pane that opens on a choice. The e2e specs that looked up the migrated search fields as `textbox` look them up as `combobox`.
