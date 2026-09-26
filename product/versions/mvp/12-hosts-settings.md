# Hosts in Settings: the backend

The 2026-09-26 export of the version-1 frames adds a **Settings page**
(`design/version1/Settings.dc.html`) with a Hosts section: the machines
a person has paired, each with a live status, and the controls to add,
rename and remove one. This note reads that frame against the `hosts/`
module as built and records what the backend had to add, what it
deliberately does not take from the frame, and what is still open.

It is the backend half only. The console screen is built with the
Settings slice; nothing here depends on it, and the fields below are
already on the wire for it.

## What the frame asks for

| On screen | Read from | State |
|---|---|---|
| Hosts nav item with a count | `GET /hosts` length | built |
| The host's name, mono | `name` | built |
| Meta line: platform, CPUs, runner version | `os`, `capabilities.cpus`, `runnerVersion` | **CPUs added** |
| Meta line: region or "local" | nothing a host knows | open, question 1 |
| Dot and word: Running · N sessions / Idle / Offline | `status`, `runningSessionCount` | **added** |
| "connected" / "last seen 2 days ago" | `online`, `lastSeenAt` | built |
| Rename in place | `PATCH /hosts/{id}` | built |
| Copy host ID | `id` | built |
| Remove host, and what it costs | `DELETE /hosts/{id}`, `runningSessionCount` | **removal now stops sessions** |
| A removed host leaves the list | `GET /hosts` | **unpaired now excluded** |
| Add host: command and agent prompt tabs | `POST /hosts/pairing` | built |
| Token countdown, "single use", New token | `expiresAt`, `replaces` | built |
| "Listening for this host…" → the host | `GET /hosts/pairing/{id}` | **added** (planned in 10, never built) |
| "Ubuntu 24.04", "git, tmux, claude ready" | the paired host's `os`, `capabilities.tools` | built, now in one read |
| "echo 41 ms" | the link's round trip | open, question 2 |

## Decided

- **A host's status is one derived word**, `running`, `idle`, `offline`
  or `unpaired` (`HOST_STATUSES` in `packages/shared`). It is computed on
  every read from three facts and never stored, for the reason `online`
  is not: a stored status is a second truth that a dead relay leaves
  lying. Unpaired wins over everything; an offline host is never
  "running" on the strength of sessions it cannot hear from
  (`hosts/domain/host-status.policy.ts`).
- **"Running" means the agent is up**: a session whose lifecycle is
  `starting` or `open` and that nobody has stopped. A stopped session
  keeps its worktrees on the machine but runs nothing, so it does not
  make a host busy. `runningSessionCount` is that count, across every
  workspace, because a host is one person's and so is what runs on it;
  the host itself was already read under the caller's scope.
- **`hosts/` asks, `sessions/` answers.** The count is a port `hosts/`
  declares (`HostUsagePort`) and `sessions/` contributes through
  `HostsModule.contributeUsage`, which is the shape `projects/` already
  uses to ask whether a project is in use. A session needs its host, so
  the import can only run that way. Unlike the archive question the
  answer is a display count, so an empty registry reads as nothing
  running instead of refusing. One grouped count per list, never one per
  host, served by `IDX_work_session_host_state`.
- **`GET /hosts` leaves unpaired hosts out** unless `include=unpaired`.
  Settings lists the machines a session can still start on, and a removed
  host showing up there reads as one that came back. The sidebar's host
  filter is the one reader that wants them: a session that outlived its
  host still needs that host's name. `GET /hosts/{id}` is unchanged and
  still answers for an unpaired host, with `status: unpaired`.
- **Removing a host stops what runs on it.** Before this, unpairing
  closed the host's link and left its sessions as they were: `open` in
  the sidebar, on a machine that would never dial in again. The remove
  dialog promises they "are stopped and their terminals closed; logs are
  kept", so `sessions/` now listens for `HostUnpairedDomainEvent` and
  appends one `session.stopped` to each running session on that host,
  with `requestedBy: host.unpaired`. **Stopped, not closed**: a close
  pushes branches and removes worktrees, which only the host can do, and
  it is gone; stopping is the control plane's own decision (03), so it
  needs nobody listening. The entry is keyed by the domain event's id, so
  the outbox's at-least-once delivery appends it once. The relay closing
  the link with the terminal code is what ends the tmux sessions on a
  runner that is still up. Both ends of unpairing do this — the console's
  remove and the runner's own uninstall — because both raise the event.
- **Add host polls one route**: `GET /hosts/pairing/{id}` answers with
  the token and, once a runner has spent it, the host it paired as the
  list shows it, status and inventory included. That is the whole of the
  "Listening…" to "build-02 · Ubuntu 24.04 · git, tmux, claude ready"
  flip, in one request. Note 10 listed this route; it had not been built,
  and the console was polling the token list and would have needed a
  second read for the host. The operation is named (`getPairingToken`)
  so adding it does not renumber the generated client's `getN`.
- **The runner reports its CPU count**, `cpus` on the facts, for the
  "32 vCPU" on the meta line. It is `runtime.NumCPU()`, which on Linux
  honours the process's affinity mask, so a runner in a limited box
  reports what it gets. Optional on both schemas and omitted at zero in
  Go, so an older runner still registers and an older control plane
  never sees the key. It lives in `capabilities` with the rest of the
  inventory rather than in a column: nothing queries by it.

## Not taken from the frame

- **The install command's shape.** The frame draws
  `curl … install.sh | sh -s -- --token opk_…`. The command stays the
  one 09 decided and `RunnerReleaseConfig` templates: the token is an
  environment assignment on the pasted line, not an argument, so it is
  in no process's argv while the installer runs, and the URL, channel
  and release base come from deploy-owned configuration. The frame's
  line is illustrative copy.
- **The frame's agent prompt.** It tells the agent to install git and
  tmux if missing and to run an `oppenheimer-runner preflight` the
  runner does not have. The served prompt keeps 09's rules: settle the
  machine and the workspace path with the person first, install nothing
  and run nothing as root unless told, and show `status` afterwards.
  Restating the installer's procedure in the prompt is the second copy
  09 declined to keep.
- **Rename's input rules.** The frame turns spaces into hyphens as you
  type. A host's name is display-only and nothing on disk derives from
  it, so the API keeps accepting any 1–80 characters; the hyphenation is
  the console's to do or not.
- **The short id.** The frame shows `h_7f3a` beside Copy host ID. The id
  is the row's UUID and that is what is copied; a short form is a
  display choice.

## Open questions

1. **Region, and "local".** The meta line reads "eu-west" for a server
   and "local" for the laptop the browser is on. Neither is a fact a
   runner has: a region would have to come from the person or a cloud
   metadata probe, and "local" is a comparison between the browser and
   the host that nothing makes today. Drop both until VMs, where the
   region is ours to know?
2. **"echo 41 ms".** The link's liveness is ping/pong (01), so the relay
   could keep the last round trip per host in memory and a host read
   could carry it. It would only be true on the replica holding the
   link, which is the same limit `online` avoided by deriving from a
   column. Keep it on the pairing read only, where the host has just
   connected, or leave it out?
3. **Routines "targeting it are paused".** The remove dialog says so for
   a host with nothing running. Routines are not built; when they are,
   pausing them is a second `HostUnpairedDomainEvent` listener in that
   module and a second `HostUsagePort` contribution for the count.
4. **Deleting the account removes host registrations.** The Profile
   half of the same page says so. Unpairing every host the account owns
   is the natural shape (the rows stay, as for any unpair), but it
   belongs to the account-deletion slice, not here.
5. **The update story on the row.** 05 asks a host row to show channel,
   pin and the last update outcome, rollback included. The frame shows
   the runner version only. The fields exist once 09's update reporting
   lands on the link; whether the Settings row carries them is the
   screen's call.
