---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": minor
"@oppenheimer/web-showcase": patch
---

Another bot's answer in a bot's chat ("Oppie replied") now arrives folded to its lead line, with a chevron to open it, instead of spreading its whole text across the transcript. `BotExchangeTurn` takes `collapsible` (and `defaultOpen`) for this; a message from another bot still shows in full.
