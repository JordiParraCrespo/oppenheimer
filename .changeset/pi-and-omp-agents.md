---
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/design-system-web": patch
---

Pi (`pi`) and Oh My Pi (`omp`) are agents a session can run. Both take a
model as `provider/id` and a thinking level, reopen their conversation with
`--continue`, and the runner installs them as the person: pi from npm, omp
with Bun. Pi has no approvals, so its sessions show no permission chip; omp's
three levels are its `--approval-mode` (`always-ask`, `write`, `yolo`). Both
are terminal only for now, with no chat view.

Settings → Agents chooses which agents New session's engine picker offers on
this device; a hidden agent stays in the picker while a draft is on it.
