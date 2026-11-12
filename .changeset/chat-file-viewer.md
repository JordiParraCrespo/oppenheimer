---
'@oppenheimer/web': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/design-system-web': patch
'@oppenheimer/translations': minor
---

Session chat: a file a turn changed opens from its row in a viewer, as the diff of what the turn wrote to it, without leaving the chat. It shows what the transcript carried, so an edit the host cut says so. A written file's line count no longer counts the newline it ends on as a line. `DiffView` waits for the diff highlighter before it mounts, so a diff that is on screen from its first render is drawn in development too.
