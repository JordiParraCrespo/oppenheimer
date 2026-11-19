---
'@oppenheimer/web': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/design-system-web': minor
'@oppenheimer/translations': minor
---

The session chat has a find bar. Ctrl+F (⌘F on a Mac) opens it over the
conversation. It searches the prompts and replies of every turn the chat
holds, including turns it has not drawn yet and words a settled turn has
folded away. It opens on the newest match. Enter goes to the one before and
Shift+Enter to the one after. The chat draws and opens the turn a match is
in and scrolls to it, and marks the matches in the text. `findInChat` is the
search, and `useStickToBottom` gains `leave()`, which stops the chat
following its end when the chat itself moves the reader up.
