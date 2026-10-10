# Session boot time, measured (formerly note 14)

A measurement note, cited elsewhere as note 14 of the top-level series;
it is not `versions/mvp/14-hosts-settings.md`. It was written on 2026-09-30, after
reports that a new session takes about 30 s to show a terminal. It records:

- where that time goes, measured from the browser;
- how Orca gets a terminal in milliseconds, from its source (`stablyai/orca`,
  HEAD `8dab53fb`);
- which experimental changes moved the numbers.

It decides nothing. The questions it raised are in the notes that own them:
02 open question 9 (network work before Send, decided 2026-10-02 in 02 §5)
and 05 open question 8 (when the pane attaches). §4 measures what was done.

Every number is from one Linux sandbox with 4 cores, reaching github.com
through a proxy. The instrument is `e2e/tests/fleet/boot-bench.spec.ts`. It
drives New session in Chromium against the real API and a real runner. It
times each hop from the click on Send to the agent's first bytes on the
attach socket, and reads the runner's `session.step` rows beside them.

## 1. Measured hops

Times are from the click on Send.

| Case | Runner: clone step | Runner: worktree step | `session.started` | First byte in the browser |
|---|---|---|---|---|
| Tiny repository (local git server) | 0.05–0.14 s | 0.01–0.03 s | 0.2–0.3 s | 2.3–2.5 s |
| facebook/react, first session (2 runs) | 3.9–4.1 s | 3.1–4.6 s | 7.4–8.7 s | 8.5–10.6 s |
| facebook/react, later sessions | 0.55–0.6 s | 0.1 s | 0.8 s | 2.3 s |
| microsoft/vscode, first session (3 runs) | 22.1–23.3 s | 10.0–12.7 s | 33.2–35.0 s | 35.1–37.3 s |
| microsoft/vscode, later sessions | 0.45–0.5 s | 0.2–0.8 s | 0.8–1.4 s | 2.4 s |

- The 30 s is **the first session on a large repository**. A blobless clone
  and the first checkout (02 §5) run while the person waits.
- On a later session the clone step is the fetch of the base, about 0.5 s
  against github.com, and the spare makes the worktree step short.
- The agent step (`tmux new-session`) takes 8–35 ms. Claude Code's own first
  paint in a new directory was 0.64 s. That was signed out, on its welcome
  screen; a signed-in boot was not measured.
- After `session.started`, the console waits for its next poll
  (`LIVE_POLL.sessionStarting`, 2 s) to see `open`. On this path that poll
  is the session list, not the session's own detail. Only then does it mount
  the terminal, mint an attach ticket, open the socket, and read the first
  bytes. That wait was 1.4–2.1 s on every run. The ticket, the socket and
  the first byte together take about 0.15 s.
- The trace shows the attach ticket requested twice for one mount.
- On the create, the 201 came back in about 0.1 s with the namer stub. A
  real model can hold it for up to `SESSION_NAMER_TIMEOUT_MS` (2 s). That
  delays navigation, not the runner.

## 2. How Orca gets milliseconds

Orca measures a smaller thing: a terminal in a worktree that already exists,
on a machine that already holds the repository.

- **The PTY owner is already running.** A detached daemon outlives the app,
  and a new terminal is one `node-pty` spawn in it. Output is batched every
  2 ms, and output that follows a keystroke takes a fast path.
- **Checkouts are prepared before the click.** Opening the create composer
  calls `worktrees:prefetchCreateBase`. That fetches the base and prepares
  up to three spare checkouts, which live 5 minutes. Create is then
  `worktree move` plus `checkout -b`. The network work happens while the
  person is typing.
- **Nothing waits on setup.** Setup scripts run in their own tab. Keystrokes
  sent before the shell is ready are queued behind a ready marker.
- **It never clones.** The repository is already local. We clone because the
  host may never have seen it, and that is what the first session pays for.

The runner already has the first shape: an always-on agent owning the
terminals, with spare worktrees. The difference is when the network work
happens relative to Send.

## 3. Experiments

These were patches applied for the run only; none is merged. Every row was
measured from the browser, except the clone modes, which were measured with
git directly against github.com.

| Change | Case | Before | After |
|---|---|---|---|
| Poll `sessionStarting` at 250 ms instead of 2 s | react, later session | 2.3 s | 0.9–1.1 s |
| Same | vscode, first session | 35 s | 59.7 s: the list, detail and events polls got HTTP 429 from the default rate limit (100 per 60 s), and the console read `starting` for 21 s after `session.started` |
| 250 ms poll, plus no create-time fetch when that ref was fetched under 60 s ago | react, later session | 2.3 s | 0.63–0.83 s |
| `checkout.workers=0` on `worktree add` | vscode, first session | runner 33.9 s | runner 32.4 s |
| Clone `--filter=tree:0`, plus `checkout.workers=0` | vscode, first session | 35–37 s | 17.5 s |

Clone modes on vscode, clone plus first `worktree add`, measured with git
directly:

| Clone | Clone | Worktree | Total |
|---|---|---|---|
| `--filter=blob:none` (02 §5) | 21.1 s | 7.4 s | 28.5 s |
| `--filter=tree:0` | 4.7 s | 10.7 s | 15.4 s |
| `--depth=1` | 4.7 s | 7.2 s | 11.9 s |
| `--depth=1 --filter=blob:none` | 0.9 s | 19.5 s | 20.4 s |

Two things were checked:

- **The default poll is safe.** With the shipped 2 s poll, one tab made
  about 92 requests a minute while a session started. Two tabs on one
  starting session drew no 429 over a 35 s start, which suggests the
  limiter counts per route.
- **Checkout itself costs time.** With every object already local, checking
  out vscode's 19.6k files took 2.0 s with one worker and 0.9 s with four.
  The first checkout after a clone took about 10 s either way, because the
  new pack is not yet in the page cache.

## 4. After: the terminal first, and the repository before Send

Two changes since the first measurement. #218 builds the session's pane
before the clone, so the terminal is there at once and the agent is typed
into it once the worktree exists. Then (02 §5, 2026-10-02) New session sends
`repository.prepare` when a host and a repository are picked, a first clone
is shallow and deepened in the background, and checkouts run one worker per
core. The same harness now waits for the agent's own first screen
(`agent_drawn`), since the first bytes are a shell.

Send → agent on screen, a host that had never seen the repository, measured
from the browser:

| Repository | Pause between the pick and Send | Before | After |
|---|---|---|---|
| facebook/react | 10 s (2 runs) | 7.8 s | 1.04–1.15 s |
| microsoft/vscode | 10 s (2 runs) | 32–34 s | 0.89–0.93 s |
| microsoft/vscode | none | 32–34 s | 11.8–12.6 s |
| facebook/react | none | 7.8 s | 4.2 s |

And the cases that were already warm, after the change (3 sessions each, the
first one cold with no pause):

| Repository | Later sessions | Tiny repository (shim / real `claude`) |
|---|---|---|
| facebook/react | 1.02–1.24 s | 0.78–0.94 s / 0.76–0.93 s |
| microsoft/vscode | 0.82–2.32 s | |

Herdr's agent on screen was 0.87–0.89 s on react and 3.9–4.5 s on vscode;
Orca's 2.1–2.7 s and 2.9–4.2 s, both on repositories already on disk.

A first session sent with no pause at all is bounded by the shallow clone and
the first checkout, which a prepare made at the moment of the pick has not
finished. Where the vscode prepare goes, with git directly (clone, then a
spare's checkout):

| Clone | Clone | Spare checkout | Ready |
|---|---|---|---|
| `--filter=blob:none` | 18.3 s | 7.5 s | 25.8 s |
| `--filter=tree:0` | 4.4 s | 8.9 s | 13.4 s |
| `--depth=1` | 5.4 s | 3.9 s | 9.3 s |

The deepen that follows a shallow clone took 35 s on vscode, off the path,
and leaves a store with the whole history (166,763 commits; `git log --
README.md` answered in 171 ms).

## 4. Reproducing

```bash
node scripts/stack/stack.mjs up --web
BOOT_BENCH=1 BENCH_RUNS=3 FLEET_HOSTS=local \
  BENCH_REMOTE=https://github.com/microsoft/vscode.git \
  PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  pnpm --filter @oppenheimer/e2e e2e:fleet tests/fleet/boot-bench.spec.ts
```
