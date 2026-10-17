---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/runner": patch
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
"@oppenheimer/docs": patch
---

Update a host's runner from the console: **Update runner** in a host card's
menu on Settings → Hosts (09 §5, "Manual control").

- `@oppenheimer/api`: `POST /v1/hosts/{id}/update` sends `host.update` down
  the host's link, through the links module's registry, and answers `202`.
  A host with no live link is `HOSTS_008` (409).
- `@oppenheimer/shared`: `host.update`'s `version` is optional. Absent, the
  runner installs the newest release on its channel and stays unpinned (a
  pinned host refuses); present, it pins, as before.
- `@oppenheimer/runner`: the generated `HostUpdate` omits an empty `version`,
  and a versionless `host.update` respects a pin (`ApplyOptions.KeepPin`):
  it skips the safe window, but a pinned host refuses with `UPD_004`.
- `@oppenheimer/api-client`: `updateHostRunner`.
- `@oppenheimer/frontend-consumer`: `HostsRepository.updateRunner` and
  `useUpdateHostRunner`.
- `@oppenheimer/web`: the menu item, off while the host is offline; a
  `hostUpdateRequested` toast on success and an `ErrorAlert` under the card
  on a refusal.
- `@oppenheimer/translations`: `hosts.settings.updateRunner`,
  `hosts.settings.updateFailed` and `toasts.hostUpdateRequested`.
- `@oppenheimer/docs`: `HOSTS_008` in the error catalog.
