---
'@oppenheimer/frontend-web': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

Success feedback in the console. The kit gains a `feedback` concern with `notifySuccess(message, action?)`, a thin wrapper over the design system's sonner. The console toasts after the writes whose result is easy to miss: Run now (with Open), pause, resume, duplicate and delete an automation, create or save a project or an automation, rename, move and delete a session, delete a project, rename and remove a host, revoke a device or every other device, change or remove the profile picture, Resend on forgot password, and a pasted image. Deleting an automation from the table now asks first, and a pick in the table's row menu no longer also opens the automation's page. All toast copy lives under `toasts.*`; the unused `copied`, `memberRemoved` and `membersInvited` keys and `settings.changePassword.done` are gone.
