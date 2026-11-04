---
"@oppenheimer/web": patch
"@oppenheimer/frontend-consumer": patch
---

Coming back to a session draws its chat at once: the tab keeps the chats of
the last five sessions it read, so the history the host sends again on
every attach changes nothing on screen where it matches. A long chat's
earlier turns come as the reader scrolls to its top, after a spinner shows
there a moment, instead of from a "Show earlier" button.

A kept chat lets go of what its pane was waiting on when the pane goes
(`SessionChat.detach`): a replay cut short keeps every line, a first load
cut short is dropped, and messages queued in that visit are not sent in a
later one.
