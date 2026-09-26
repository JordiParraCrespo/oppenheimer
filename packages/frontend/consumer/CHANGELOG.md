# @oppenheimer/frontend-consumer

## 1.0.0

### Major Changes

- 5bd4a8b: New session sets how a session is launched, and `POST /sessions` takes it.

  The route grows a `launch` object — model, permission level, effort — and the
  `prompt` typed into the composer. The launch is folded onto `work_session` so a
  restart can relaunch a session the way it was launched without walking its log.
  The prompt is a log entry and rides `session.create` to the host, where it
  becomes the agent's trailing argument rather than something typed at a running
  terminal — so nothing about the composer waits on the relay, and exactly one of
  the two ends ever writes `prompt.first`. It also names the session, through a
  new `openai-compatible` namer provider that covers Groq, Together, vLLM and a
  local Ollama.

  The agent catalog in `@oppenheimer/shared` grows each agent's models and the
  argv its permission levels, effort stops and first task map to, read off
  claude 2.1.278's and codex-cli 0.155.1's own `--help`.

  **Breaking, `@oppenheimer/frontend-consumer`:** `SessionEntity` was modelling one
  repository, one branch and a `running | idle | stopped` state the control plane
  had stopped sending. It carries `checkouts`, the derived `state` group and the
  stored `lifecycle` now, and `create` takes an idempotency key from its caller.

### Minor Changes

- 24d217d: Add host is a dialog in the console.

  - `@oppenheimer/web`: New session's host chip opens the Add host dialog instead
    of navigating to `/onboarding/host`; the dialog owns the Command / Agent
    prompt switch, the panel and a footer that arms on a registered host.
  - `@oppenheimer/frontend-web`: new `hosts` concern with `HostPairingChrome` —
    the token line and the status row the onboarding step and the dialog both
    draw.
  - `@oppenheimer/frontend-consumer`: `useHostPairing` (in `react/hosts.pairing.ts`)
    is the pairing flow both surfaces run; it counts `secondsLeft` rather than
    formatting a clock. `useCurrentPairing`, `usePairingTokens` and `useHosts`'s
    poll are its internals and leave the barrel; the unused `usePairHost` is gone.
  - `@oppenheimer/translations`: new `hosts` namespace for the pairing copy both
    surfaces read, `sessions.new.addHost.*` for the dialog's own words, and
    `common.close`.

- f099524: The organizations repository no longer swallows a failed read into an empty list.
- a880b19: Connecting a host is hardened. An unpaired host is refused a link and stops dialling. The pairing-token cap holds under concurrent mints, and `POST /v1/hosts/pairing` takes `replaces` to retire the token on screen in the same write. The owner is emailed when a machine pairs. The agent prompt is a short template around the install command. `runner uninstall --force` keeps the pairing when a session cannot be ended, and a re-run of the installer restarts the systemd unit on the new release.
- bb3c4e8: `useSessionStartProgress` reads how a session's start is going: the steps its host reported, and the host's reason when it failed.
- e717f42: Harden the runner link. PTY bytes are no longer dropped when a queue fills,
  and the runner's writer sends control frames first, then takes attachments in
  turn, so one pane's output no longer delays another pane's echo. Both sides
  now ping every 15 s, a runner the control plane cannot write to is closed
  rather than skipped, and epochs keep rising across API restarts. The
  terminal's transport (`SessionStream`, the resize coalescer, the replay
  stream) moves from `apps/web` into `@oppenheimer/frontend-consumer`, behind
  `SessionsService.openStream` and `useSessionStream`.
- f099524: Name the product's own non-persisted queries: `CONSUMER_NON_PERSISTED_FEATURES` adds `sessions`, `hosts`, `apiTokens` and `profile`.
- bfa1020: `installationsKeys` gains `detail`, `repositoryList` and `repository`; `repositories(id)` is now a scope, and branches are keyed `[..., 'repositories', 'detail', repoId, 'branches']`. Hosts pairing keys are `hostsKeys.pairingTokens()` (`['hosts', 'pairing', 'tokens']`, was `pairings()`) and `currentPairing(name)` (`[..., 'current', { name }]`). `useSession`, `useSessionStartProgress`, `useCheckSlug` and the installation pickers take `undefined` for an input that isn't known yet and fetch with `skipToken`. `useRegister` also invalidates `profileKeys.me()`. Mutation hooks go through `withCacheOnSuccess`.
- bbacd49: Build the runner ↔ control-plane link so a session can be created and run from the console.

  - API: `relay/` mounts the two sockets of the protocol on the API's own HTTP server — the runner link (`GET /api/v1/relay/runner`, boot assertion as bearer, hello/welcome, heartbeat → host presence, `events.append` → the session log, acked by key) and the browser attach socket (`GET /api/v1/relay/attach`, single-use ticket as the subprotocol, re-checked against the session and the workspace membership). `links/` holds the per-host link registry and the real `SessionDispatchPort`, replacing the pending adapter.
  - Runner: `internal/link` dials out with a per-dial EdDSA boot token, pins the control plane's key fingerprint from `welcome`, reconnects through the ladder with an epoch, streams PTY reads as attachment-id-prefixed frames and reports events with `<runId>:<n>` keys, resending what was not acked. `session.create` maps the structured launch onto the agent's argv through the catalog mirror; the sessions service gained `Stop` and a caller-provided id.
  - Web: `SessionStream` is the real transport over the attach socket, minting a fresh ticket per (re)connect; the terminal shows `offline` while the host holds no link.
  - Credentials: `credentials.token` is answered with a `credentials.grant` sealed to the host's key (Ed25519 → X25519, ephemeral ECDH, HKDF, AES-256-GCM); the runner's git credential helper pulls the token over the link, unseals it and holds it in memory until expiry or `credentials.revoke`. Hello reconciliation re-dispatches a launch the host never carried out and records stopped a session it lost. `attachment.credit` pauses PTY reads at 256 KB in flight; `host.preflight` and `host.update` are handled.
  - Shared: the protocol gains `welcome`, `session.stop`, `session.detach`, `command.failed`, `attachment.closed` and the attach socket's own vocabulary; `CacheService` gains `take()` (`GETDEL`).

- f023fd9: Opening a session from the list renders the row the cache already holds instead of waiting on a second read.
- f099524: The api-tokens repository drops the casts the loose types forced, including a `dto as never` that was disabling type checking on the create-token body.

### Patch Changes

- 9a8fb1b: A session that is still starting is read again every two seconds until the host has opened it, so New session lands on the terminal without a reload.
- Updated dependencies [cb56034]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [669b0d3]
- Updated dependencies [669b0d3]
- Updated dependencies [a880b19]
- Updated dependencies [9ed9703]
- Updated dependencies [7945f7e]
- Updated dependencies [f099524]
- Updated dependencies [79e30e5]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [8e2de68]
- Updated dependencies [8e2de68]
- Updated dependencies [e717f42]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [5bd4a8b]
- Updated dependencies [ed28ce2]
- Updated dependencies [f099524]
- Updated dependencies [2701a0c]
- Updated dependencies [a23b14e]
- Updated dependencies [bfa1020]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [bbacd49]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [8fab63d]
- Updated dependencies [bb3c4e8]
- Updated dependencies [f101364]
- Updated dependencies [f101364]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/frontend-core@0.3.0
  - @oppenheimer/api-client@0.3.0
