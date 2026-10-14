---
"@oppenheimer/web": patch
---

Holding Backspace in a Claude Code session no longer deletes the `❯` prompt
for a moment. Claude Code draws the prompt as `❯` and a no-break space, which
the typeahead read as text, so a guessed Backspace went through the prompt
until the host refused it and the line sprang back. Any space now ends a
prompt mark.
