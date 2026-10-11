---
name: netsim
description: Simulate real-world networks for the local stack (the browser and each runner host somewhere in the world, behind fibre, cable, ADSL, 4G, Starlink, hotel Wi-Fi or satellite) and measure how the terminal feels on the relay and on the direct WebRTC path. Use when asked how typing or the terminal performs over slow, far or lossy connections, to compare relay and direct path numbers, to reproduce a latency complaint from a particular place or connection, or to check a change to the relay, the runner's link, the direct path or the console's terminal for a performance regression.
---

# Simulate the network

`e2e/netsim` gives the browser and each local host a network namespace of
its own and routes every packet between them through one Go process. That
process applies the delay, jitter, loss and rates of two last miles and the
distance between them. The relay stays in the root namespace, where the API
and the console run, placed in Falkenstein like the dev deployment. Its
design is in `e2e/netsim/README.md`, and the figures are in
`e2e/netsim/profiles.json`.

It needs **Linux, root and `/dev/net/tun`**, and no `netem`. A Mac cannot
run it.

## 1. Stand the stack up

```bash
node scripts/stack/stack.mjs up --web
```

## 2. Pick what to run

### The typing bench (the usual answer)

`e2e/tests/netsim/typing.spec.ts` pairs one host per connection type, all in
Barcelona. Then, for each browser place and each host, it opens the session
twice, once on the relay and once on the direct path. Each time it types
`NETSIM_KEYS` keys, waiting for every echo, and reads the console's echo
readout (p50 / p95, keystroke to echo).

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  pnpm --filter @oppenheimer/e2e e2e:netsim
```

| Variable | Default | Narrows to |
| --- | --- | --- |
| `NETSIM_BROWSERS` | `same-lan,same-city,new-york,tokyo` | where the browser is |
| `NETSIM_HOSTS` | `fiber,cable,adsl,4g,starlink` | the hosts' connections (any access in `profiles.json`) |
| `NETSIM_KEYS` | `20` | keys per cell; 25+ for a steadier p95 |

The full matrix is 20 cells and takes about 20 minutes. One cell takes about
a minute, so narrow it while iterating:
`NETSIM_BROWSERS=same-city NETSIM_HOSTS=fiber NETSIM_KEYS=10`. Point
`PLAYWRIGHT_CHROMIUM_PATH` at whatever Chromium the environment ships, or
drop it to use Playwright's own.

It writes:
- `e2e/test-results/netsim-typing.md`, the table;
- `netsim-<browser>-<host>-<path>.png`, one screenshot per measurement;
- one console line per cell as it goes.

It also writes the `terminal_direct_path` flag on for everyone, then puts it
back as it was.

### A scenario by hand

To look at something the bench does not cover, such as a resize storm, an
agent's output or a dropped link, run `netsim` directly:

```bash
go build -o /tmp/netsim ./e2e/netsim
# nodes.json: the relay, its ports, and the nodes (README has an example)
/tmp/netsim up --config /tmp/nodes.json --state /tmp/netsim-state &
/tmp/netsim exec --state /tmp/netsim-state browser -- <command>
```

From TypeScript, `e2e/support/netsim.ts` does the same:
- `netsimUp` starts it;
- `startLocalHost(name, token, { enter: enter('host-x') })` runs a fleet host
  on a node;
- `browserOn('browser', chrome)` gives a Chromium to launch on a node;
- `place` moves a node mid-run;
- `legStats` / `resetLegStats` read and reset the per-leg counters.

The control endpoint at `127.0.0.1:7077` takes `PUT /nodes/{name}` with
`{"location","access","lan"?}` to move a node while the session stays open.
That is how to show a connection degrading under a live terminal.

## 3. Read the numbers honestly

- **They are a model, not a measurement.** `profiles.json` holds typical
  figures. Compare the two paths under the same conditions; never quote a
  cell as what one particular person will see.
- **The page loads next to the relay**, and the scenario is applied once the
  terminal is live. A Vite dev server's modules over 4G from Tokyo would
  measure Vite, not typing. ICE setup time is therefore not in the numbers.
- **Check the byte columns.** A direct run should send almost nothing via
  the relay: credits, resize and pings stay on the socket by design. A
  direct run that shows the keystroke traffic on the relay never really
  switched.
- **p95 over 20–25 keys is one or two samples.** Read it as a hint. Raise
  `NETSIM_KEYS` before drawing a conclusion from it.
- The direct path saves the most where the relay is the detour: same LAN,
  same city. From the far side of the world it still saves the relay's extra
  leg, but the distance to the host dominates. A lossy link hurts the relay's
  TCP more than the direct path's datagrams, and that shows in p95.

## 4. Change the simulator

- **A new place or connection** is an entry in `profiles.json`: a `geo` row to
  every other location, or an `access` with a `note`. `go test
  ./e2e/netsim/...` fails if a location lacks a distance to any other.
- **The model** is `model.go`: per-node uplink and downlink queues, both last
  miles plus geography, half-normal jitter that never reorders a leg, and a
  drop past 400 ms of queue. Its tests pin each behaviour with fixed
  randomness.
- `pnpm ci:local` runs its Go vet, lint and tests whenever the e2e package
  changes.

## 5. Tear down

```bash
node scripts/stack/stack.mjs down
```

The bench stops `netsim` itself. If a run was killed, find what is left with
`pgrep -af 'netsim up'`, stop it, and remove its namespaces with
`umount /tmp/oppenheimer-netsim/state/ns/*`. `pnpm ci:local` stops the stack,
so never run it while a bench is going.
