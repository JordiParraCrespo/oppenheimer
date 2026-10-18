# Desktop spike

The Electron shell from [`../desktop-app-spike.md`](../desktop-app-spike.md).
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
