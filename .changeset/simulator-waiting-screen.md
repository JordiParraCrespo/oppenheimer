---
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
"@oppenheimer/design-system-web": minor
---

The Simulator says it is waiting instead of showing a black phone.

- `@oppenheimer/web`: until the device sends its first picture, the phone's
  screen shows "Waiting for the screen…" and what the agent last said it is
  doing (OSC 7501); after 15 seconds with no picture it says the simulator
  may still be booting or the app still building, with Refresh devices.
  A tap before the first picture is not sent.
- `@oppenheimer/translations`: `sessions.preview.noPicture`,
  `noPictureDetail`, `noPictureSlow` and `agentDoing`.
- `@oppenheimer/design-system-web`: `--device-screen-fg` and
  `--device-screen-fg-muted`, words on the device's black screen in both
  themes.
