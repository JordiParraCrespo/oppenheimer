---
"@oppenheimer/runner": patch
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/web": patch
---

The Simulator tab streams smoothly and takes taps and drags as they are made.
The runner scales each frame it sends to 720 pixels wide
(`RUNNER_DEVICE_SCREEN_WIDTH`): a simulator's full-resolution frames were
larger than the link carries, and seven in ten were dropped on the host
without a word; one that still does not fit is logged now. A drag goes to the
device with its own duration, and a flick with momentum, through the new
optional `durationMs` and `momentum` on `device.input`; before, every drag was
a 300 ms swipe sent once the pointer lifted. Taps made while the device's
socket reconnects are held for a few seconds and sent once it is back, under a
"Reconnecting" notice over the phone's last frame, instead of being lost.
