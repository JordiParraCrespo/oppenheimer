---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

Pick the session's device in the Simulator tab, and refresh it.

- `@oppenheimer/shared`: `device.info` gains `devices` (each `serial`,
  `name`, `platform`, `free`; `DEVICE_CHOICES_MAX`), and the link gains
  `device.select`; the attach socket's `device` carries `devices` and takes
  `device.select` from the browser.
- `@oppenheimer/runner`: a device attach looks at the host's devices afresh
  and lists them; `device.select` moves the session onto a free one,
  switches the screen on the same attachment and rewrites the agent's
  session note. A device another session holds is refused.
- `@oppenheimer/api`: the relay passes `devices` through and forwards
  `device.select`, dropped from a read-only share.
- `@oppenheimer/frontend-consumer`: `DeviceStream.select` and `refresh`;
  `DeviceChoice`.
- `@oppenheimer/web`: the Simulator's device line is a picker when the host
  offers more than one, with Refresh beside it.
- `@oppenheimer/translations`: `sessions.preview.device`, `deviceSearch`,
  `deviceEmpty`, `deviceTaken`, `refreshDevice` and `platform.*`.
