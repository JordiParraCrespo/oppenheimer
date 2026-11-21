---
"@oppenheimer/web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
---

Every composer completes emoji: typing `:` and two letters (`:hap`) opens a
menu of the emoji whose GitHub shortcode or tag matches, the way Claude Code
on the web does; Up and Down move, Tab or Enter puts the emoji in the
shortcode's place, Escape closes it.

- `@oppenheimer/web`: the bot chat's box, a session chat's box, New session's
  box and the second agent's box open the menu.
- `@oppenheimer/frontend-web`: `useEmojiMenu` and `ComposerEmojiMenu`; the
  emoji list (`gemoji`) is its own chunk, fetched the first time a shortcode
  is typed. `useCommandMenu` takes any row with an `id`, not only a slash
  command.
- `@oppenheimer/translations`: `common.chat.emoji.menu` and `.pick`.
