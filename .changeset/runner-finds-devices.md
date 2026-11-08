---
"@oppenheimer/runner": minor
---

A host offers its sessions the simulators and emulators it has running, with
no setup: with `RUNNER_DEVICES` unset, a session that asks for a device takes
one of the iOS simulators simctl reports booted or the emulators adb sees,
and the runner finds Argent's `simulator-server` beside the `argent` on its
PATH and the tool-server Argent has running in `~/.argent`, read again on
each input because Argent moves it. Before, a host that named no devices
offered none, and the Simulator tab of every session said "No device".
`RUNNER_DEVICES=off` offers none; naming devices works as before.
