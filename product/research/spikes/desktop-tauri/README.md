# Desktop spike, Tauri

The Tauri twin of [`../desktop-spike`](../desktop-spike/README.md) (Electron),
and the bench that compares them. The findings are in
[`../../desktop-electron-vs-tauri.md`](../../desktop-electron-vs-tauri.md).
It is not a workspace package or a Cargo workspace member, and it builds on
its own.

- `src-tauri/src/main.rs` opens the hosted console in a window, sends every
  other link to the system browser, and implements the bridge to the
  runner's local socket. The console reaches the bridge through a
  capability granted to its origin alone.
- `bridge.js` is `window.oppenheimerDesktop`, the same `LocalTerminals`
  contract as the Electron preload, built on Tauri's IPC.
- `bench/` holds `run.mjs` (the harness), `page.js` (what runs in the
  console), and `stub-runner.mjs` (the runner's socket routes, echo and
  flood).
- `results/` holds the raw runs behind the note's tables, and
  `screenshots/` the console in each shell after sign-in.

## Build and run

On Linux, install the WebKitGTK headers first:
`apt-get install libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev libayatana-appindicator3-dev`.

```bash
cd src-tauri && cargo build --release
OPPENHEIMER_CONSOLE_URL=http://localhost:3000 ./target/release/oppenheimer-desktop-tauri
```

`RUNNER_HOME` (default `~/.oppenheimer`) locates `run/runner.sock`.
`OPPENHEIMER_NO_BRIDGE=1` shows the console as a browser sees it, and
`OPPENHEIMER_NO_COALESCE=1` sends one IPC message per runner frame, which
was the bridge's first, slower behaviour. To package it:
`npx @tauri-apps/cli@2 build --bundles deb,appimage`.

## The bench

The bench needs the console with an account that can sign in, both spikes
built (the Electron one installed as its README says), and Xvfb.

```bash
node scripts/stack/stack.mjs up                     # from the repo root: Postgres, Redis, the API
(cd apps/web && pnpm build && npx vite preview --port 3000)
BENCH_EMAIL=… BENCH_PASSWORD=… node bench/run.mjs --runs 5 [--only electron|tauri]
```
