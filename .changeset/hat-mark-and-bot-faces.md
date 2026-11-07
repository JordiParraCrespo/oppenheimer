---
'@oppenheimer/design-system-web': minor
'@oppenheimer/web': minor
'@oppenheimer/extension': patch
---

The product's mark is a white fedora on an ink tile, the same in both
themes: `BrandMark` draws it (new `--brand-tile` and `--brand-hat` tokens),
`Wordmark` now leads with it, and the console's and the docs' favicons and
the extension's icons are the same drawing.

A bot with no photo shows a drawn face instead of its initials: a round
face in its avatar colour wearing a hat, cut out like a sticker on a darker
shade of that colour. The hat, eyes and mouth are picked from the bot's id,
so the face survives a rename. `BotAvatar` takes `seed` in its option,
`BotItem` and `AvatarColorPicker` take `seed`; without one they draw the
initials as before.
