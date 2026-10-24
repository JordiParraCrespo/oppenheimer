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
- **The console picks local first.** `LocalFirstSessionStream`
  (`packages/frontend/consumer/src/modules/sessions/stream/local-first-stream.ts`)
  asks the bridge whether this machine's runner holds the session; if so it
  attaches through the socket, and if not, or if that fails or later closes,
  it hands the stream to the attach socket with its WebRTC path (22). The
  bridge is a port (`LocalTerminals`) the web app binds at composition when
  the preload is there; in a browser nothing is bound and nothing changes.
  The terminal's drained bytes go back as credit, and the shell stops
  reading the runner past 1 MiB outstanding, so a slow pane leaves its
  backlog in tmux as on the relay. A page that reloads or closes takes its
  attachments with it.

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
| 21 MB of output (`seq 1 3000000`) in a local session | done in 4.8 s, main process +10 MB, typing fine after |
| Reload the page three times, then leave and quit | one tmux client throughout, none after |

### Start at home, continue abroad

Under `e2e/netsim`, with the home runner on Barcelona fibre and a second
device on hotel Wi-Fi in Tokyo, every packet through the simulator:

| Leg | Device | Path | Echo p50 / p95 | Tickets |
|---|---|---|---|---|
| Start a Python REPL, set `x`, quit the app | desktop at home | `local` | 5 / 20 ms | 0 |
| Open the same session, `print(x)` | another device in Tokyo, fresh sign-in | `direct` (WebRTC to home) | 297 / 328 ms | 2 |
| Open it again at home, `print(x)` | desktop at home | `local` | 4 / 6 ms | 0 |

`print(x)` gave the value set at home both times: one live process, three
attachments, and the desktop's choice of path is made per attachment, so
leaving and coming back needs nothing. The Tokyo device took two minutes
to show the terminal because it loaded the Vite dev server's unbundled
modules over simulated hotel Wi-Fi (43 MB); that measures the dev server,
not the product. Typed characters there are drawn at once by predictive
echo (22); the readout is the true round trip.

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
