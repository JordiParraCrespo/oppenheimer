---
"@oppenheimer/api": minor
"@oppenheimer/shared": patch
---

Bots save and fix their own skills, from Hermes Agent's learning loop
(`product/versions/mvp/25-bots.md` §4.1, Skills).

- `@oppenheimer/api`: the prompt says when to save a skill unasked; a turn
  someone waits on that has run 6 tool calls with no skill used or saved is
  reminded once, in an `<oppenheimer_reminder>` line the prompt announces
  and a tool's output cannot forge; `use_skill` says whether the bot or the
  person wrote the skill last; a new `patch_skill` tool replaces one exact
  passage of a skill. `save_skill` and `patch_skill` change a skill the person wrote only
  when they asked, and never one of Oppenheimer's own.
- `@oppenheimer/shared`: the guide bundle, with the new "Bot skills and
  commands" page.
