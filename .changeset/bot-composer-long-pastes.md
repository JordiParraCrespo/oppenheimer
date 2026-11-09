---
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

The bot composer holds a long paste (over 1,000 characters or 10 lines) as one
label, `[Pasted text #1 +1000 lines]`, the way Claude Code and Codex do, and
sends the pasted text in its place. Backspace or Delete takes a label out
whole. A message longer than a bot takes keeps send off and says so.
