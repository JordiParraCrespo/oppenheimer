---
"@oppenheimer/api": patch
---

Automations: the hourly rate caps hold under concurrency, and the runs list reads only its window.

- The one-minute schedule tick runs every statement on its own transaction's
  connection. It reads the workspaces' limits and the last hour's counts once,
  inside the claim, and counts the runs it queues as it goes, so a batch cannot
  fire past a cap. It claims triggers `FOR NO KEY UPDATE SKIP LOCKED`.
- Event firing and the tick take a per-workspace advisory lock around count and
  insert (`fireUnderCaps`), so concurrent events, or events and a tick, cannot
  all take the last slot. An event reads the workspace's settings once.
- The runs list scopes on `automation_run."organizationId"` beside the window,
  so the scan starts at the window, and it reads its counts in one grouped
  statement instead of two. The response is unchanged.
- The run-limit sweep skips runs live past the platform ceiling plus an hour,
  so they can no longer take every slot, and it reads each automation and owner
  once per tick.
- Archiving a project finds its automations by workspace and project.
