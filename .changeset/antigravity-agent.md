---
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/design-system-web": patch
---

Antigravity (Google's `agy`) is an agent a session can run, with Gemini 4
Neon, Carbon, Argon and Hydrogen, Gemini 3.8 Flash, and Antigravity's Claude
Opus 5.5 and Sonnet 5.5. Its three permission levels are `--mode default`,
`--mode accept-edits` and `--dangerously-skip-permissions`; the effort is
`--effort`, the first task `--prompt-interactive`, and a stopped session
reopens its conversation with `--continue`. `runner agents install
antigravity` installs `agy` from Google's release, checked against the
manifest's SHA-512; agy keeps itself current. Terminal only for now, with no
chat view, and switched on in Settings → Agents.
