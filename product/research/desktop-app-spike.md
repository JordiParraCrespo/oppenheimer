# The desktop app, spiked

Asked for on 2026-10-18: a desktop app where a session on your own machine
is a terminal straight to it, as in Orca, and where everything still works
out of the box away from home. This note is the spike and what it measured;
it decides nothing. The plan is for the owner to settle, and the decisions
will go to a numbered note under `versions/mvp/` with a line in
`../README.md` (note 00 rejected Electron because "state must live
server-side"; this shape keeps it there, since the window is the hosted
console).

## The shape tried

- **Electron, loading the hosted console.** One window on the console's
  origin, every other link to the system browser, a sandboxed renderer with
  context isolation, and one bridge in the preload
  (`window.oppenheimerDesktop`). Code: `desktop-spike/src/`.
- **The runner's local socket carries the terminal.** The runner already
  listens on `~/.oppenheimer/run/runner.sock`, 0600 in a 0700 directory, for
  the credential helper. The spike adds `GET /v1/sessions/{id}/attach`
  there (`apps/runner/internal/cli/local_attach.go`): a WebSocket, binary
  frames PTY bytes both ways, text frames a resize. Only this account can
  dial it, which is the whole of its authorization.
- **The console picks local first.** `DesktopSessionStream`
  (`packages/frontend/consumer/src/modules/sessions/stream/desktop-stream.ts`)
  asks the bridge whether this machine's runner holds the session; if so it
  attaches through the socket, and if not, or if that fails or later closes,
  it hands the stream to the attach socket with its WebRTC path (22). In a
  browser there is no bridge and nothing changes.

Rejected: spawning `tmux attach` from Electron with `node-pty`, as Orca
does. It is a native module per platform and per Electron version (Orca's
own pain point, note 01), and it would teach the desktop the runner's tmux
socket and target names and step around the runner's rules (read-only,
session state).

## Measured (2026-10-18, one container, real API, runner, tmux and console)

| Case | Result |
|---|---|
| Sign in with email and password inside the window | works |
| A session on this machine | path `local`, echo p50 4–5 ms, no attach ticket minted |
| A session on another host | relay, then `direct` (WebRTC) on its own, unchanged |
| Control plane killed while typing locally | the terminal keeps working |
| Local runner killed mid-session | screen kept, "offline" shown, back when the runner is |
| Cold start with the control plane down | "Connection problem": no session can be opened |

The runner ran as root in that container with its root check patched out of
a throwaway build (the sandbox allowed no second account); nothing of that
is in the code.

## What it showed

1. On one machine the local path is no faster than WebRTC (22 measured
   4.1–4.3 ms there too). What it buys is independence: no ticket, no ICE,
   no relay first, and a terminal that survives the control plane or the
   internet going. A second machine on the same network already gets 1–5 ms
   over WebRTC host candidates.
2. A cold start still needs the control plane: the console is loaded from
   it and reads the session through it. Working offline from a cold start
   means bundling the console in the app.
3. The spike falls back to the network for good once the local attachment
   closes; it should go back to local when the runner returns.

## Not tried

GitHub and Google sign-in inside the window (Google refuses embedded
browsers; the usual answer is the system browser and an `oppenheimer://`
deep link), macOS builds, signing, notarization and auto-update, real-world
networks, and Windows (the runner does not run there, so a Windows desktop
would reach remote hosts only).

## Open questions for the owner

1. The hosted console in a window, or the console bundled in the app?
2. Does the desktop install and pair the runner for "this machine" itself?
3. macOS first?
4. Electron rather than Tauri (the system WebView: WebKit on macOS, where
   none of this was tested)?
