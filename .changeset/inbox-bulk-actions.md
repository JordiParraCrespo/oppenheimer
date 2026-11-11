---
'@oppenheimer/web': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/design-system-web': minor
'@oppenheimer/translations': minor
'@oppenheimer/api': minor
'@oppenheimer/shared': minor
'@oppenheimer/api-client': minor
---

The Inbox takes bulk actions. Check rows (on hover, shift-click for a run, or Select in a row's menu), then mark them all done, deprioritize, snooze or delete them from the bar that replaces the list's head. Escape clears the selection. The API marks a whole selection in one request, `POST /v1/inbox/marks/batch`, checking every key before it writes any.
