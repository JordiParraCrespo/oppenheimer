---
"@oppenheimer/web": patch
---

Deleting a line typed ahead of the host no longer bounces at its start. The
prediction counted the prompt (`❯ `) as text, so Backspaces held past the last
letter were drawn deleting the prompt too, until the host refused them and the
line sprang back a second later. The prompt's mark is now left out, and a
Backspace or Left at the start of the text is predicted to do nothing, as a
line editor does, instead of dropping the deletions drawn before it.
