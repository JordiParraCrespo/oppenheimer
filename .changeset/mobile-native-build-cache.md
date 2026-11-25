---
"@oppenheimer/mobile": minor
---

Native builds are kept by fingerprint and reused by every checkout whose native side matches, so a new worktree installs an existing dev client instead of compiling it again; ccache is on for iOS.
