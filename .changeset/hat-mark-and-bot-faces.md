---
'@oppenheimer/design-system-web': minor
'@oppenheimer/web': minor
'@oppenheimer/extension': patch
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/frontend-web': patch
'@oppenheimer/translations': minor
---

The product's mark is a white fedora on an ink tile, the same in both
themes: `BrandMark` draws it (new `--brand-tile` and `--brand-hat` tokens).
It is the rail's top, `RailMark`, a link home in the console, and stands
beside the name on sign-in and the public pages; the console's and the
docs' favicons and the extension's icons are the same drawing.

A bot with no photo shows a drawn face instead of its initials: a round
face in its avatar colour wearing a hat, cut out like a sticker on a darker
shade of that colour. The hat, eyes and mouth are picked from the bot's id,
so the face survives a rename. `BotAvatar` and `BotItem` take `face`
(`{ color, seed }`, the bot's colour and id) in place of `color`, and
`AvatarColorPicker` takes `seed`; without a `face` they draw the initials
on the control fill.

A bot's owner picks its face in Profile, under the colour: `BotFacePicker`
offers a row each for the hat, the eyes and the mouth, drawn in the bot's
colour, and Use its own face goes back to the id's. It is stored as
`bot."avatarFace"` (`jsonb`, null until picked, held by
`CHK_bot_avatar_face`), sent as `avatarFace` on `PATCH /v1/bots/:id` and
answered on every bot; `BotFaceSpec` takes it as `parts`, and the
consumer's `BotEntity.face` hands the three together.

`Wordmark` is the name alone again; the console's rail carries the mark at
its top (`RailMark`, now `BrandMark`, a link home with the `nav.home` name).
