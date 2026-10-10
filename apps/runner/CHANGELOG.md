# @oppenheimer/runner

## 0.2.0

### Minor Changes

- 27af598: The agent catalog gains an `update` argv (the CLI's unattended updater), and the
  runner keeps installed agent CLIs current with it (`runner agents update` by
  hand). Claude Code and OpenCode seed Claude Sonnet 5.5 (`claude-sonnet-5-5`) in
  place of Sonnet 5.
- a880b19: Connecting a host is hardened. An unpaired host is refused a link and stops dialling. The pairing-token cap holds under concurrent mints, and `POST /v1/hosts/pairing` takes `replaces` to retire the token on screen in the same write. The owner is emailed when a machine pairs. The agent prompt is a short template around the install command. `runner uninstall --force` keeps the pairing when a session cannot be ended, and a re-run of the installer restarts the systemd unit on the new release.
- 09cea4c: Effort is each CLI's own levels, per model, instead of five product stops.

  - `@oppenheimer/shared`: each model lists its effort levels and default, each agent spells a level once, and `effortLevelFor` decides what may be recorded.
  - `@oppenheimer/runner`: launch effort is keyed by model and dropped when the model lacks it or the saved launch predates levels.
  - `@oppenheimer/api` / `@oppenheimer/api-client`: sessions, their log and automation revisions record only a level their model offers.
  - `@oppenheimer/web` / `@oppenheimer/translations`: the slider draws the model's levels and sends nothing until moved.
  - `@oppenheimer/design-system-web`: `EffortSlider` and `EffortPicker` take their stops from the caller; `EFFORT_STOPS` is gone.

- fc0e75d: The hosts backend for the Settings page (`product/versions/mvp/14-hosts-settings.md`).

  - `@oppenheimer/api`: a host read carries a derived `status` (`running`, `idle`,
    `offline`, `unpaired`) and `runningSessionCount`, counted by `sessions/`
    through `HostsModule.contributeUsage`. `GET /v1/hosts` leaves unpaired hosts
    out unless `include=unpaired`. Removing a host, from either end, stops the
    sessions running on it. New `GET /v1/hosts/pairing/{id}` returns the token and
    the host it paired, for Add host's "Listening for this host…".
  - `@oppenheimer/shared`: `HOST_STATUSES`, `listHostsQuerySchema`, and an
    optional `cpus` on the host facts, on both Zod entry points.
  - `@oppenheimer/api-client`: regenerated; `getPairingToken`,
    `PairingTokenStatusResponseDto`, `HostStatus`.
  - `@oppenheimer/runner`: the facts report the logical CPU count as `cpus`.
  - `@oppenheimer/api`: host metadata tables (`host_inventory`, `host_presence`,
    `host_network`, `host_event`), backfilled from `host`; the old columns stay
    until the code switches over (`product/versions/mvp/15-host-metadata.md`).
  - `@oppenheimer/api`: heartbeats write `host_presence` and, only when the
    machine changed, `host_inventory`, with the change on the host's timeline;
    host responses carry `machine`, `vitals` and `network`;
    `GET /v1/hosts/{id}/timeline`. The network a runner connects from is
    recorded and placed with DB-IP Lite (`HOSTS_GEOIP_CITY_DB`,
    `HOSTS_GEOIP_ASN_DB`, the `ip_geolocation` capability); a move to another
    country or network operator emails the owner. A daily job purges networks
    unseen for 90 days and timeline entries past 180.
  - `@oppenheimer/runner`: reports OS name, kernel, CPU model, memory, disk
    total, virtualization, cloud, time zone, boot time and service manager,
    and available memory on the heartbeat.
  - `@oppenheimer/backend-email`: `sendHostNetworkChanged` and its template.
  - `@oppenheimer/translations`: `emails.hostNetworkChanged`.

- 2202daa: A session's first task can carry images.

  - `@oppenheimer/shared`: `session.create` carries `images` for runners that name `session.create.images`; `POST /sessions` takes `attachmentIds`.
  - `@oppenheimer/api`: `POST /v1/sessions/attachments` stages an image for the create that names it.
  - `@oppenheimer/runner`: pulls a create's images and names their paths to the agent with the task.
  - `@oppenheimer/frontend-consumer`: `useUploadSessionAttachment`.
  - `@oppenheimer/web`, `@oppenheimer/translations`: the paperclip and paste attach images to the first task.

- e505b9e: A host gets the repository ready while New session is still being written:
  picking a host and a repository sends `repository.prepare`
  (`POST /v1/sessions/prepare`), and the host clones or fetches it and builds a
  spare worktree, so the create that follows starts in about a second. A first
  clone is shallow and deepened in the background, checkouts write from one
  worker per core, and session branches are cut `--no-track`.
- bbacd49: Build the runner ↔ control-plane link so a session can be created and run from the console.

  - API: `relay/` mounts the two sockets of the protocol on the API's own HTTP server — the runner link (`GET /api/v1/relay/runner`, boot assertion as bearer, hello/welcome, heartbeat → host presence, `events.append` → the session log, acked by key) and the browser attach socket (`GET /api/v1/relay/attach`, single-use ticket as the subprotocol, re-checked against the session and the workspace membership). `links/` holds the per-host link registry and the real `SessionDispatchPort`, replacing the pending adapter.
  - Runner: `internal/link` dials out with a per-dial EdDSA boot token, pins the control plane's key fingerprint from `welcome`, reconnects through the ladder with an epoch, streams PTY reads as attachment-id-prefixed frames and reports events with `<runId>:<n>` keys, resending what was not acked. `session.create` maps the structured launch onto the agent's argv through the catalog mirror; the sessions service gained `Stop` and a caller-provided id.
  - Web: `SessionStream` is the real transport over the attach socket, minting a fresh ticket per (re)connect; the terminal shows `offline` while the host holds no link.
  - Credentials: `credentials.token` is answered with a `credentials.grant` sealed to the host's key (Ed25519 → X25519, ephemeral ECDH, HKDF, AES-256-GCM); the runner's git credential helper pulls the token over the link, unseals it and holds it in memory until expiry or `credentials.revoke`. Hello reconciliation re-dispatches a launch the host never carried out and records stopped a session it lost. `attachment.credit` pauses PTY reads at 256 KB in flight; `host.preflight` and `host.update` are handled.
  - Shared: the protocol gains `welcome`, `session.stop`, `session.detach`, `command.failed`, `attachment.closed` and the attach socket's own vocabulary; `CacheService` gains `take()` (`GETDEL`).

- df6d451: A repository's store is a blobless clone with no working tree. A session create fetches only the branch its worktree is made from, with no tags and no automatic gc, and takes a spare worktree the runner checked out ahead of it.
- bb3c4e8: The runner logs each step of starting a session as `session.step`, with the time each took, and resends unacknowledged batches in the order it made them.
- b2fd6a1: A session takes files, not only images: PNG, JPEG, GIF and WebP as before,
  plus PDF and UTF-8 text (plain, Markdown, CSV, JSON, code, logs), pasted,
  dropped or attached to the first task. Every file is judged by its bytes at
  the API and again on the host: executables, archives, scripts with a `#!`
  line, SVG and HTML are refused whatever they are called, and the runner
  names each file itself. A runner announces the wider set with the
  `session.files` capability; an older one is still sent images only.
- a566fac: A session's start says when the host is downloading the repository for the
  first time: the clone step carries `download`, and the start pane explains
  the longer wait.
- 3404cd3: A session's terminal can be shared with a link, to watch or to type, for anyone, any signed-in account or named people (`product/versions/mvp/21-session-share-links.md`).

### Patch Changes

- da32bb1: One exec helper and one WebSocket writer pump for the Go services.

  - `@oppenheimer/go-execx` (new): `execx.Run(ctx, Spec{Name, Args, Dir, Env,
Timeout, KillGroup, WaitDelay, Output})` runs a command to completion,
    returns its output on failure too, reports `TimedOut` / `Canceled`, kills
    the process group on cancel when asked, and bounds the wait for output a
    child left open (`DefaultWaitDelay`, 5 s).
  - `@oppenheimer/go-ws`: `Pump` / `PumpChan` are the one writer for a socket,
    with pings between frames on a busy one; the hub's connections use
    `PumpChan`. Validation replies use `problem.ErrValidation.Code` rather than
    a copy of `RUNNER_001` (same value on the wire).
  - `@oppenheimer/runner`: tmux, git, systemd, launchd, the host probes and the
    staged binary's selfcheck run through `execx` with unchanged timeouts,
    output and error text; every one of them now stops waiting for output a
    leftover child holds open. The control-plane link writes through `ws.Pump`.

- 88f7898: Generate the runner's link protocol from the shared schema instead of keeping a hand-written Go twin. Wire-neutral: the same bytes on the wire before and after.

  - Shared: `RUNNER_LINK_REFUSAL_HEADER`, `RUNNER_LINK_REFUSALS`, `LINK_FRAME_HEADER_BYTES` and `ATTACHMENT_CREDIT_WINDOW_BYTES` join the close codes in `protocol/link.ts`, and the schema artifact carries every link constant under `x-constants`. The build also writes `protocol-schema/samples.json` (one message of every type, from the build-only `src/protocol/samples.ts`) and, through the new `scripts/emit-link-protocol.cjs`, `apps/runner/internal/link/protocol.gen.go`. Requiring an emitter no longer rewrites its output, so the committed-file specs can fail; `check:generated` runs every emitter's `--check`.
  - Runner: `link/protocol.go` keeps only what is not wire shape; the structs, the type names and the constants are generated. `link/protocol_test.go` decodes every TypeScript sample with `DisallowUnknownFields`, holds each struct and the host's `Facts`/`Tool` to the schema, and checks the constants and gofmt. The lifecycle commands decode into their own messages rather than one merged struct. The package now declares `@oppenheimer/shared`, so a shared-only change runs the Go job.
  - API: the refusal header, the `host-unpaired` refusal and the frame header width come from `@oppenheimer/shared/protocol`.

- e717f42: Harden the runner link. PTY bytes are no longer dropped when a queue fills,
  and the runner's writer sends control frames first, then takes attachments in
  turn, so one pane's output no longer delays another pane's echo. Both sides
  now ping every 15 s, a runner the control plane cannot write to is closed
  rather than skipped, and epochs keep rising across API restarts. The
  terminal's transport (`SessionStream`, the resize coalescer, the replay
  stream) moves from `apps/web` into `@oppenheimer/frontend-consumer`, behind
  `SessionsService.openStream` and `useSessionStream`.
- 6b943c3: Removing a host stops its sessions on the machine, as the remove dialog says.
- 38b511f: Restart brings a session back where it left off, and the stopped pane says so.

  A restart recreated window 0 and started the agent from nothing, replaying the
  first task — so the conversation was lost and the work asked for twice. Now
  that a session names the agent's own conversation, a restart reopens it
  instead: same worktree, same branch, the whole exchange back, and no prompt
  re-sent because the conversation already holds it. Grok joins Claude Code;
  Codex and OpenCode can only resume an id they chose themselves, so they keep
  restarting the way they did.

  The pane that said "This session has stopped. Its work is on its branch" now
  names the branch, says restarting brings the terminal back where it left off,
  and leads with **Restart**. A deleted session has no worktree to return to, so
  it is offered nothing.

- 7f94a9d: Close pushes the session branch with that session's GitHub credential.
- eee2b40: Keep the link's read loop responsive and serialise updates.

  - `host.update` and `host.preflight` run off the read loop, each on a lane of its own and on the daemon's context, so **Update now** on a slow connection no longer stops the pongs, drops the link and cancels its own download. A preflight collects the host once, not twice.
  - A browser's keystrokes go to a bounded queue per attachment that one goroutine writes to the PTY; a wedged `tmux attach` client closes its own attachment (`attachment.closed`, "input stalled") instead of stalling the link.
  - `session.resize` for an open attachment is applied inline, not behind the session's lane; one for an attachment still opening keeps its place behind the attach.
  - An attach whose PTY opens after its link dropped is closed rather than streamed on the next link under an id that link may have given someone else.
  - `Updates.Apply` and `Rollback` run one at a time in the process, and staging uses unique file names, so the periodic check, **Update now** and `runner update` never download into the same file.
  - Event batches refused with backpressure while the link stays up are retried every 5 s in order, a flush stops at the first refusal, and at most 4096 batches wait (the oldest is dropped with a warning).

- 81f0347: A session on a private repository clones, and a create survives the link dropping while it runs.
- e3975db: `runner run` makes its home and `run/` directories private before it opens the
  control socket: a directory left looser than `0700` (created by hand, by an
  older version, or restored from a backup) is tightened, and a symlinked one, or
  one another account owns, is refused with `HOST_008`. That closes the window
  between the socket's `Listen` and its `Chmod 0600`, in which the socket that
  hands out installation tokens had the process umask's permissions.
- c4e3622: A refresh no longer overwrites a stop or a close, and polling costs less.

  - A session refresh is a compare-and-set: it is dropped when a command wrote
    the session while it looked, or is still working on it, and it never moves
    a session out of `stopped` or `closed`. A close that raced a refresh no
    longer comes back as `working` and then `stopped`, so the console no longer
    shows a second `session.stopped` after a close or an ordered stop.
  - The session map is written only when a session changed; a quiet poll writes
    nothing.
  - The poll loop lists the tmux server once per tick (`list-panes -a`) and runs
    one `capture-pane` per live session, instead of `has-session`,
    `capture-pane` and `display-message` for each.
  - Tool versions and the macOS version are cached per executable (path, mtime,
    size) with a 10-minute backstop; a preflight probes afresh.
  - Concurrent credential-helper calls for one session share a single
    `credentials.token` ask, and one caller giving up does not fail the others.

- 5b93fd7: Runner review follow-ups. `systemctl`, `loginctl` and `launchctl` calls now time out after a minute. `runner sessions` refreshes the whole host in one pass. An event batch the link took but never acked is sent again after a minute, together with every batch made after it, in order. The link has one frame cap, `LINK_MAX_FRAME_BYTES` (512 KiB), shared by the control plane and the generated `MaxFrameBytes`: the runner reads nothing larger and never sends anything larger. When the session list in `hello` and `heartbeat` does not fit, it is sent compact, and only past about 2,800 sessions is it truncated.
- 12b89c7: **Upgrade note:** a runner home that is a symlink is now refused. `runner run`
  stops with `HOST_008` ("The runner's own directory is not safe to use") when
  `~/.oppenheimer` (or `RUNNER_HOME`), or the `run/` directory under it, is a
  symlink, where earlier versions followed it. A host whose home was moved to
  another disk and linked back stops coming online after this update, and its
  service keeps restarting into the refusal. Put the real directory back in
  place (`target="$(readlink -f ~/.oppenheimer)" && rm ~/.oppenheimer && mv
"$target" ~/.oppenheimer`) or install again with `RUNNER_HOME` set to the real
  path, then restart the service. The error reference's runner section
  (`apps/docs/docs/errors.md#host_008`) has the steps.
- 020f0df: Sessions stop handing the host's CPU to Spotlight, and launch on a plausible
  terminal.

  - **The workspace root is kept out of the desktop search index.** A session is
    a worktree with its dependencies installed, so a host running a few of them
    holds several complete copies of a repository — gigabytes across hundreds of
    `node_modules` directories, rewritten whenever an agent installs something.
    macOS indexed all of it: on a host with eight sessions open,
    `mdworker_shared` took more CPU than the agents, `tmux list-panes` passed its
    ten-second deadline, and the control-plane link missed its pings, so the
    terminals in the browser went blank. The runner now writes
    `.metadata_never_index` at the workspace root, both when a root is chosen and
    on every boot, so an existing pairing gets it without re-pairing. Deleting
    the file turns indexing back on.
  - **A detached session launches at 132x40 rather than tmux's 80x24.** An agent
    lays its turn out for the terminal it is told about, so a session created and
    left alone — every session between "send" and the reader opening it, and
    every session an automation runs — did its work in 80 columns and then
    reflowed into the console's ~130 when someone finally looked. `window-size
latest` still hands the window to a real viewport the moment one attaches.

- c2288fb: A new session opens on its agent. The runner starts the agent in place of the
  pane's shell (`tmux respawn-pane`) instead of typing the line that starts it,
  and the console keeps the start's steps on screen until the agent step lands.
- 8f5fd3d: A session names the agent's own conversation, so a stopped session can be
  reopened instead of read back.

  These CLIs already keep the transcript — the catalog's `transcriptLocation` is
  where — so nothing said in a session was ever lost. What was missing was a name
  both sides agree on: the CLI picked its own id and told nobody, so the only way
  back to a conversation was the tmux pane, which dies with the session. A run
  stopped by the hour limit left a console screen saying "This session has
  stopped" and nothing else, which for an automation run is the whole result.

  The launch now carries `conversation`, the session's own id, and the catalog
  says per agent how to pin it and how to reopen it — `--session-id` and
  `--resume` for Claude Code. An agent whose CLI cannot be told an id, or that
  keeps no transcript at all (the blank terminal), is sent nothing.

  Verified end to end: a session created, answered, its tmux session destroyed,
  and `--resume` in the same worktree brought back the whole conversation, live
  and ready for a follow-up.
