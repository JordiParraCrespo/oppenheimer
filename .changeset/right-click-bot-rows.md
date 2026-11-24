---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
---

A right-click on a bot's sidebar row, in Employees or under a section's Bots heading, and on a review session's row under For review, opens the row's own menu at its ellipsis instead of the browser's, as a session's row already did. Every such row takes its menu's state and its right-click from one hook, `useRowMenu` in the design system.
