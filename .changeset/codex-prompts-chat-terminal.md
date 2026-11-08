---
"@oppenheimer/runner": patch
"@oppenheimer/web": patch
---

A Codex session shows the person's prompts again. The runner reads what
was typed from the `UserMessage` an `item_completed` finishes, which is
where Codex 0.167 writes it since it stopped writing `user_message` to the
rollout, so the Chat tab no longer opens on the reply alone. In the
terminal, Codex's grey prompt block (the `›` row, its padding and image
labels) is drawn as the same bubble as a Claude Code prompt rather than a
bright slab.
