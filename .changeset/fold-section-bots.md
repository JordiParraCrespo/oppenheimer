---
'@oppenheimer/web': patch
'@oppenheimer/frontend-web': patch
'@oppenheimer/design-system-web': patch
---

A section's Bots heading folds: its label is a toggle, with a chevron shown
on hover and while folded, and the fold is kept per section on this device.
`SidebarFoldLabel` is the toggle, passed as a `SidebarListHead` label, and the sidebar's
stored-list helpers (`storedList`, `useStoredList`, `withFold`) move to
the platform kit, now that bots and sessions both keep lists on the device.
