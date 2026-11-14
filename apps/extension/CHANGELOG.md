# @oppenheimer/extension

## 0.2.0

### Minor Changes

- 8baff58: Sessions in Claude Code's cloud. New session's Where offers _Claude Code
  cloud_ on a host: that host's runner fetches the repository with a token
  sealed into the create, runs `claude --cloud <task>` in a scratch checkout,
  reports the cloud session's id and keeps nothing. The session's pane has no
  terminal: its state, _Open in claude.ai_ and `claude --teleport <id>`. Its
  state comes from the Chrome extension, which, connected with a personal token
  pinned to the workspace, posts what it sees on claude.ai to
  `POST /sessions/cloud-status`; the API records it for the sessions the
  workspace launched (`place: cloud`, `cloudSessionId`, runner capability
  `session.cloud`, errors `SESSIONS_037` and `SESS_008`).
- 8baff58: A Chrome extension that tracks your Claude Code cloud sessions (claude.ai/code,
  `claude --cloud`, scheduled tasks): a badge with how many need you, a
  notification when one comes to need you, fails or finishes, and a popup — the
  Inbox cut down to sessions — that opens a session or copies
  `claude --teleport <id>`. No sign-in of its own; it reads with the claude.ai
  sign-in already in Chrome.

### Patch Changes

- aeeb48b: The product's mark is a white fedora on an ink tile, the same in both
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

- Updated dependencies [e711f5c]
- Updated dependencies [a602949]
- Updated dependencies [566f850]
- Updated dependencies [7b5c7b3]
- Updated dependencies [c9aa79c]
- Updated dependencies [7b0e91d]
- Updated dependencies [1d57cbf]
- Updated dependencies [43193e4]
- Updated dependencies [dfd07de]
- Updated dependencies [50be89a]
- Updated dependencies [1df2b19]
- Updated dependencies [7944eae]
- Updated dependencies [50429c4]
- Updated dependencies [344ce8c]
- Updated dependencies [d314623]
- Updated dependencies [d5d4fd4]
- Updated dependencies [c5c09d0]
- Updated dependencies [be15bdc]
- Updated dependencies [38ffaaf]
- Updated dependencies [e315b92]
- Updated dependencies [089b66c]
- Updated dependencies [b283349]
- Updated dependencies [cfa236a]
- Updated dependencies [0d83e40]
- Updated dependencies [08bb08b]
- Updated dependencies [6568fab]
- Updated dependencies [be941d8]
- Updated dependencies [929db14]
- Updated dependencies [4faf606]
- Updated dependencies [3d54930]
- Updated dependencies [8612fd8]
- Updated dependencies [18e4a35]
- Updated dependencies [7f18bbe]
- Updated dependencies [4201798]
- Updated dependencies [8fc6c25]
- Updated dependencies [39dbe36]
- Updated dependencies [201ee3a]
- Updated dependencies [502a40c]
- Updated dependencies [ac929fa]
- Updated dependencies [5dfebed]
- Updated dependencies [39d9703]
- Updated dependencies [59809f9]
- Updated dependencies [060dabb]
- Updated dependencies [f09b6b3]
- Updated dependencies [3dbe5f1]
- Updated dependencies [629ea1d]
- Updated dependencies [581c202]
- Updated dependencies [c7a6f7a]
- Updated dependencies [6af341b]
- Updated dependencies [0044013]
- Updated dependencies [9716225]
- Updated dependencies [d5ebd8d]
- Updated dependencies [419f41c]
- Updated dependencies [9ddd8a1]
- Updated dependencies [db2a91a]
- Updated dependencies [3223f4b]
- Updated dependencies [c11f8a3]
- Updated dependencies [8baff58]
- Updated dependencies [b39d40f]
- Updated dependencies [33cb1d8]
- Updated dependencies [55acf65]
- Updated dependencies [3230edb]
- Updated dependencies [f6a81a2]
- Updated dependencies [7a8851a]
- Updated dependencies [61f1092]
- Updated dependencies [a956535]
- Updated dependencies [6eb8d65]
- Updated dependencies [73ce336]
- Updated dependencies [663e8ed]
- Updated dependencies [c1161c5]
- Updated dependencies [e8fd98c]
- Updated dependencies [fc246b3]
- Updated dependencies [170ce4c]
- Updated dependencies [d68e9c4]
- Updated dependencies [231fb59]
- Updated dependencies [33cb1d8]
- Updated dependencies [aeeb48b]
- Updated dependencies [d264253]
- Updated dependencies [291469b]
- Updated dependencies [fda123f]
- Updated dependencies [85c11ad]
- Updated dependencies [48da240]
- Updated dependencies [1484bc6]
- Updated dependencies [02894e4]
- Updated dependencies [dd3acdd]
- Updated dependencies [cca8cfb]
- Updated dependencies [ce6374e]
- Updated dependencies [50c9d05]
- Updated dependencies [7c0a70c]
- Updated dependencies [7c0a70c]
- Updated dependencies [35f32be]
- Updated dependencies [c63402e]
- Updated dependencies [fa1a47b]
- Updated dependencies [9b0c57f]
- Updated dependencies [1496a5f]
- Updated dependencies [da6226c]
- Updated dependencies [3b5d381]
- Updated dependencies [a6d67d7]
- Updated dependencies [723089c]
- Updated dependencies [88f61b5]
- Updated dependencies [9871b11]
- Updated dependencies [250c8d6]
- Updated dependencies [0079b26]
- Updated dependencies [67df985]
- Updated dependencies [0f2f802]
- Updated dependencies [a80436f]
- Updated dependencies [146d7d1]
- Updated dependencies [fa85016]
- Updated dependencies [d4606c6]
- Updated dependencies [19d77e6]
- Updated dependencies [4f9afb3]
- Updated dependencies [1dbae54]
- Updated dependencies [6917f62]
- Updated dependencies [d69ddc4]
- Updated dependencies [ecf6d14]
- Updated dependencies [d687bfd]
- Updated dependencies [45604ff]
- Updated dependencies [d687bfd]
- Updated dependencies [aa92290]
- Updated dependencies [ea93480]
- Updated dependencies [11fa44a]
- Updated dependencies [45d642b]
- Updated dependencies [fe61b51]
- Updated dependencies [ec96195]
- Updated dependencies [1f7f57b]
- Updated dependencies [6125030]
- Updated dependencies [b5a9490]
- Updated dependencies [1fcf738]
- Updated dependencies [f384b6a]
- Updated dependencies [db80935]
- Updated dependencies [c8c4f9b]
- Updated dependencies [f8eda6e]
- Updated dependencies [db4ae58]
- Updated dependencies [8283986]
- Updated dependencies [a69aa94]
- Updated dependencies [828d404]
- Updated dependencies [2d187ed]
- Updated dependencies [5b1c52a]
- Updated dependencies [4ee069d]
- Updated dependencies [1af8fa3]
- Updated dependencies [4ee069d]
- Updated dependencies [27f034a]
  - @oppenheimer/design-system-web@1.0.0
  - @oppenheimer/translations@0.4.0
