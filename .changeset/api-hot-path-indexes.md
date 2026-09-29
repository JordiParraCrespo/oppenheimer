---
"@oppenheimer/api": patch
---

Index the automation and session hot paths and drop two unused indexes.

- New: `IDX_automation_run_dispatched` (partial, the live-run checks on every
  tick and dispatch), `IDX_automation_run_created_brin` (the nightly run purge),
  `IDX_work_session_event_first_prompt` (partial, the first prompt on a runner's
  hello), and `IDX_work_session_created_by` / `IDX_session_checkout_installation`
  behind two foreign keys that had none.
- `IDX_automation_trigger_automation` is rebuilt with `automationId` first.
- Dropped: `IDX_session_checkout_session` and `IDX_work_session_organization_state`.
