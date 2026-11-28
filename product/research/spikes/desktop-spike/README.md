# Desktop spike

The Electron shell from [`../../desktop-app-spike.md`](../../desktop-app-spike.md).
Not a workspace package; it installs on its own.

```bash
npm init -y && npm install electron@37 ws playwright-core
npx electron src/main.cjs   # OPPENHEIMER_CONSOLE_URL (default http://localhost:3000), RUNNER_HOME
```

`terminal.mjs <session-id> <label>` signs in with `../account.json`, opens the
session, types, and prints the echo readout (`local`, `relay` or `direct`).
`outage.mjs <session-id> <label> "<command>"` types, runs the command (kill
the API, kill the runner), and types again. Both run under `xvfb-run` on a
machine without a display.

`flood.mjs <session-id>` prints a lot and reads the main process's memory;
`reload.mjs <session-id>` counts tmux clients across reloads and quitting;
`handoff.mjs <session-id> home|abroad|back` is one leg of starting a session
at home and continuing it elsewhere (`abroad` runs with no bridge and a
fresh profile, under `netsim exec … abroad --` to put it far away).

`OPPENHEIMER_BENCH=<script>` runs a bench script in the console once it has
loaded, and prints what it reports. The script and its harness are
[`../desktop-tauri/bench/`](../desktop-tauri/README.md), which compares this
shell with its Tauri twin.
