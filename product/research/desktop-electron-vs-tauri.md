# The desktop app: Electron or Tauri, measured

Open question 4 of [the desktop spike](desktop-app-spike.md) asked
whether the desktop should be Electron or Tauri. This note answers it with
a Tauri twin of that spike (`desktop-tauri/`) and the same bench run in
both shells. It decides nothing. If the owner picks a shell, the decision
goes in the numbered desktop note under `versions/mvp/` that the spike
already calls for.

## What was built

- **The same shape in both.** One window on the hosted console, every
  other link sent to the system browser, and the runner's local socket
  reached through `window.oppenheimerDesktop`. That is the `LocalTerminals`
  port the console already binds (`apps/web/src/lib/oppenheimer.ts`), so
  `apps/web` needs no change for either shell.
- **Electron** is the spike as it was (`desktop-spike/`). It gained one
  hook: print when the console has loaded and run the bench script under
  `OPPENHEIMER_BENCH`.
- **Tauri 2.12** (`desktop-tauri/src-tauri/src/main.rs`) implements the
  bridge in Rust: an HTTP `GET` and a WebSocket over the runner's Unix
  socket (tokio and tungstenite), the same 1 MiB / 256 KiB credit window,
  attachments owned by the page that opened them and closed when it
  navigates. The page side (`desktop-tauri/bridge.js`) is an
  initialization script that turns Tauri's IPC and a channel into the same
  contract the Electron preload exposes.

## Measured (2026-11-16, one Linux container, Xvfb, software rendering)

Both shells loaded the production build of `apps/web` (`vite preview`,
with the `/api` proxy) against the real API from `scripts/stack/stack.mjs`.
`desktop-tauri/bench/run.mjs` starts each shell with a fresh profile, five
times each and alternating which goes first. In each run the page signs in
through the console's own form, sits idle for five seconds, then drives
the bridge against a stub of the runner's socket (`bench/stub-runner.mjs`:
the same routes, echo on, and 21 MiB of output on request). Memory is
summed over the whole process tree. The raw runs are in
`desktop-tauri/results/`.

| Median of 5 runs | Electron 37 | Tauri 2.12 (WebKitGTK 2.52) |
|---|---|---|
| Spawn to console loaded | 524 ms | 848 ms |
| Sign-in through the form | 311 ms | 438 ms |
| Memory idle after sign-in, PSS | 344 MB | 491 MB |
| Memory idle after sign-in, RSS | 635 MB | 660 MB |
| Processes | 6 | 3 |
| Echo, mean of 300 round trips through the bridge | 0.53 ms | 1.13 ms |
| 21 MiB of output through the bridge | 312 ms (67 MB/s) | 211 ms (99 MB/s) |
| Echo right after the flood, p50 | 0.4 ms | ≤ 1 ms |
| Memory after the bench, PSS | 351 MB | 528 MB |

| Package (x86_64 Linux) | Electron (electron-builder 26) | Tauri (tauri-cli 2) |
|---|---|---|
| `.deb` download | 86 MiB | 2.3 MiB |
| `.deb` installed | 283 MB | 7 MB, plus `libwebkit2gtk-4.1-0` (91 MB) if the system lacks it |
| AppImage (brings its own engine) | 110 MiB | 77 MiB |

Both rendered the console the same way after sign-in
(`desktop-tauri/screenshots/`). Electron also shows its default
`File / Edit / View` menu bar, which the spike never removed.

### What the numbers needed

- **Tauri's bridge first ran at 30 MB/s**, against Electron's 71. Each
  channel message larger than a few bytes costs the page one IPC fetch, and
  those fetches, not the bytes, set the limit. Coalescing the frames already
  waiting into one message, up to 256 KiB, raised it to 99 MB/s, while a lone
  keystroke's echo still goes at once (`results/2026-11-16-both-before-coalescing.txt`
  beside `…-both.txt`). Electron sends one IPC message per frame and would
  gain from the same change.
  The coalesced rate depends on how many frames are already waiting, so it
  follows the machine's load: later that day, with the API and a second
  server running, the Tauri bridge measured about 72 MB/s and Electron's
  about 62 (`results/2026-11-16-tauri-refactor-ab.txt`).
- **WebKit clamps `performance.now()` to 1 ms**, so a single echo reads 0
  or 1 ms there. The mean over 300 round trips is the fair comparison.
- **`.bin/electron` is a Node wrapper.** Launching through it added a
  process and about 2 s to Electron's first run, so the harness starts the
  Electron binary itself.

## What it shows

1. **On Linux, Tauri wins on download size only.** It started slower and
   used more memory than Electron: 491 vs 344 MB PSS idle. The usual
   "Tauri is lighter" holds for the installer (2.3 vs 86 MiB), not for the
   running app. WebKitGTK is Tauri's weakest engine, and these numbers say
   nothing about macOS.
2. **Both bridges are far faster than anyone types.** The real local path
   through the runner and tmux measured 4–5 ms echo
   ([the spike](desktop-app-spike.md)). Each shell adds 0.5 to 1 ms of that,
   and both drain a 21 MiB burst in a third of a second or less.
3. **Tauri's security model is stricter by default, and that matters
   here.** A remote origin (the hosted console) reaches no command unless a
   capability names its URL. The shell grants only the console's origin,
   only in the main window, and only the six bridge commands. Electron gets
   the same effect from context isolation and a sandboxed preload, but
   nothing enforces it if a later change adds `nodeIntegration` or a
   broader preload.
4. **Tauri's shell is about 400 lines (307 of Rust, 95 of JavaScript)
   against Electron's 200 of JavaScript.** The Rust reads well, but it puts
   Rust on the desktop's critical path, and that is a language nobody else
   in this repository writes.
   Electron's main process is Node, as the API, the CLI and the MCP server
   are.
5. **Tauri ties the console to each platform's WebView.** That means WebKit
   on macOS and Linux and WebView2 on Windows, so CSS, WebRTC (the direct
   path, 22) and xterm's WebGL renderer have to be tested in each.
   Electron ships one Chromium, the same engine the console is developed
   and tested in.

## Not tried

- **macOS**, which the spike suggests as the first target. WKWebView is
  part of the system there, so Tauri's memory and size are likely to
  compare better than on Linux. That is inferred, not measured.
- **Windows.**
- **A real runner and tmux behind the Tauri bridge.** The stub speaks the
  same routes, and the runner and tmux side is the same code for both
  shells.
- **The direct (WebRTC) path and the attach socket inside WebKitGTK.**
- **GitHub and Google sign-in through the system browser and a deep
  link.**
- **Signing, notarization and auto-update** for either shell.

## For the owner

Recommendation: **stay on Electron for the first desktop.** Make Tauri a
macOS-only question, and measure it on a Mac before choosing it. On the one
platform measured, Tauri saves download size but costs memory, start-up
time, a second language and a WebView matrix. Its strengths are a stricter
IPC model and a small installer, and those don't outweigh the costs while
the window is the hosted console. If the owner wants Tauri anyway, the
twin here is a working start: the bridge, the capability and the
coalescing are done. Two open questions remain:

1. Does download size matter enough to take Tauri for it (86 MiB vs
   2.3 MiB on Linux)?
2. Measure both on a Mac before deciding?
