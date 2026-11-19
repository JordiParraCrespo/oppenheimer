---
"@oppenheimer/runner": patch
"@oppenheimer/web": patch
---

Links an agent prints in the terminal (Claude Code's Markdown links, sent as OSC 8 hyperlinks) are clickable again: tmux now passes their URL through to the browser, and the console opens them in a new tab instead of asking first.
