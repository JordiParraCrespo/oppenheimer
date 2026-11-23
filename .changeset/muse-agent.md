---
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/api": patch
"@oppenheimer/shared": minor
"@oppenheimer/design-system-web": patch
---

Muse (Meta's Muse Code, `muse`) is an agent a session can run. It offers
Muse Spark 1.3, Muse Spark 1.2 (its default) and Muse Ember 1.0, each with
`--reasoning-effort` from minimal to ultra, and its three permission levels
are `--approval-mode untrusted`, `--approval-mode on-request` and `--yolo`.
`runner agents install muse` installs its launcher, refusing one whose
response carries no checksum, and the launcher fetches the native binary
against its release manifest's SHA-256 and keeps it current itself.

Muse is off in Settings → Agents until switched on, terminal only, and takes
no task on the command line: the person types the first one, a restarted
session opens a fresh Muse, and automations do not offer it.
