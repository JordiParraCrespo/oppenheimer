---
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/design-system-web": patch
---

Hermes (`hermes`, Nous Research's agent) is an agent a session can run. It
starts as `hermes chat` with the first task as `--query`, which on a terminal
seeds an interactive session, and reopens its conversation with `--continue`.
It runs the model and approvals its own configuration names (`hermes model`,
`approvals.mode`), so the picker offers no model, effort or permission chip
for it, and the runner keeps it current with `hermes update --yes` but does
not install it: Nous's only installer is a piped script nothing checks.
Settings → Agents lists it, off on a fresh device, with its mark.
