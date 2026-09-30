# 14 — Session boot time: where the 30 seconds go

Measured from the browser on 2026-09-30, after reports that a new session
takes about 30 s to show a terminal. Orca's source was read for comparison
(`stablyai/orca`, HEAD `8dab53fb`). Every number below comes from a run on
one Linux sandbox (4 cores). The harness is
`e2e/tests/fleet/boot-bench.spec.ts`: it drives New session in Chromium
against the real API and a real runner, and records each hop from the click
on Send to the agent's first bytes over the attach socket. Beside those it
records the runner's own `session.step` timings.

## 1. The answer

The 30 s is the **first session on a large repository**. It is spent in git
before the agent starts. Our platform adds about 2 s on top of that, and it
adds those 2 s to every session.

| From the browser, Send → first byte | Runner done | clone step | worktree step | First byte |
|---|---|---|---|---|
| Tiny repo (local git server) | 0.2–0.3 s | 0.05–0.12 s | 0.02 s | 2.3–2.5 s |
| facebook/react, first session | 7.4 s | 4.1 s | 3.1 s | 8.5 s |
| facebook/react, later sessions | 0.8 s | 0.55–0.6 s | 0.1 s | 2.3 s |
| **microsoft/vscode, first session** (3 runs) | 33.2–35.0 s | 22.1–23.3 s | 10.0–12.7 s | **35.1–37.3 s** |
| microsoft/vscode, later sessions | 0.8–1.4 s | 0.45–0.5 s | 0.2–0.8 s | 2.4 s |

The agent step (`tmux new-session`) takes 8–35 ms. Claude Code's own first
paint in a fresh directory is 0.64 s. It was measured signed out, which is
its welcome screen; a signed-in boot could not be measured here.

## 2. What happens, hop by hop

```
0 ms       click Send
~100 ms    POST /sessions → 201; the runner already has session.create (WS push)
~150 ms    console on /sessions/:id, showing the provisioning pane
           runner: clone step = `git fetch` of the base (warm) or a blobless clone (cold)
           runner: worktree step = claim a spare, or `git worktree add` (lazy blob fetch)
           runner: tmux new-session … claude → session.started
+0–2 s     next 2 s poll of the list and the detail sees `open`
           → mount xterm → POST attach-ticket (sent twice) → WS /relay/attach
+~150 ms   first PTY bytes
```

On a warm repository the runner finishes in under a second, and then the
console waits **1.4–2.1 s** for its next poll (`LIVE_POLL.sessionStarting =
2000`). On a cold one, the clone and the first checkout are the 30 s.

## 3. How Orca gets milliseconds

Orca measures something smaller: a new terminal in a worktree that already
exists on a local machine.

- **The PTY daemon is already running.** It is a detached process that
  outlives the app. A new terminal is a `node-pty` spawn in a hot process,
  with no tmux and no network in between. Output is batched every 2 ms, and
  output after a keystroke takes a fast path.
- **Prepared checkouts.** Opening the create composer calls
  `worktrees:prefetchCreateBase`. That fetches the base and builds up to
  three spares (`worktree add --detach --no-checkout`, then
  `reset --hard`, then `worktree lock`, each kept 5 minutes). Create becomes
  `worktree move` plus `checkout -b`. The fetch happens while the person is
  typing, not after they press Send.
- **Nothing waits for setup.** Setup scripts run in their own tab.
  Keystrokes sent before the shell is ready are queued behind a
  shell-ready marker.
- **Orca does not clone.** It works on a repository the person already has
  checked out. We clone because the host may never have seen the
  repository. That cost is ours alone, and it is why our first session is
  slow.

The runner already has Orca's shape: an always-on agent owning the PTYs, and
spare worktrees (02-runner §5). What we lack is doing the network work
**before** Send, and telling the browser the moment the session is up.

## 4. Experiments, measured from the browser

| # | Change (experimental patch, not merged) | Case | Before | After |
|---|---|---|---|---|
| E1 | `sessionStarting` poll 2000 → 250 ms | react, warm | 2.3 s | 0.9–1.1 s |
| E1 | same | vscode, cold | 35 s | **59.7 s**: the three polls (list, detail, events) hit the API's rate limit (HTTP 429, `RATE_LIMIT_DEFAULT_LIMIT=100`/60 s) and the console saw `starting` for 21 s after the runner reported `session.started` |
| E2 | E1 + skip the create's `git fetch` when this ref was fetched < 60 s ago | react, warm | 2.3 s | **0.63–0.83 s** (runner 0.23–0.31 s) |
| E3 | `checkout.workers=0` on `worktree add` | vscode, cold | runner 33.9 s | runner 32.4 s |
| E3 | clone `--filter=tree:0` + `checkout.workers=0` | vscode, cold | first byte 35–37 s | **17.5 s** (clone 4.8 s, worktree 12.0 s) |

Clone modes measured with git directly against github.com (vscode, clone
plus first `worktree add`):

| Mode | Clone | Worktree | Total |
|---|---|---|---|
| `--filter=blob:none` (today) | 21.1 s | 7.4 s | 28.5 s |
| `--filter=tree:0` | 4.7 s | 10.7 s | 15.4 s |
| `--depth=1` | 4.7 s | 7.2 s | 11.9 s |
| `--depth=1 --filter=blob:none` | 0.9 s | 19.5 s | 20.4 s |

With every object already local, checking out vscode's 19.6k files takes
2.0 s with one worker and 0.9 s with four. The first checkout after a clone
takes about 10 s with either, because the new pack is not yet in the page
cache.

What was checked and ruled out:
- At the default 2 s poll, one tab makes about 92 requests a minute while a
  session starts. Two tabs on one starting session drew no 429 over a 35 s
  boot, so the limiter appears to count per route. The default interval is
  safe, but it cannot go much lower.
- Naming (`SESSION_NAMER_TIMEOUT_MS`) did not delay the 201 here: the stub
  answers at once, and the 201 took about 100 ms. A real LLM can hold the
  201 for up to 2 s. That delays navigation only, not the runner.

## 5. What to change, in order of payoff

1. **Take the clone off the critical path.** Fetch and prepare a spare the
   moment the repository is known, which is before Send. Candidates are:
   when New session picks a repository (Orca's `prefetchCreateBase`), when a
   project with default repositories is created, when a host pairs with an
   installation, and a periodic fetch of mirrors a host already has.
   Measured effect: the first session on a warmed repository takes the warm
   times above, 2.3 s today and about 0.7 s with 2 and 4 applied, instead of
   35 s. A very large repository still takes 15–30 s to warm, so warming
   must start early. It needs a `session.prepare` frame from the API to the
   runner (01-protocol).
2. **Push `open` to the browser instead of polling for it.** This saves
   1.4–2 s on every session (E1 is the upper bound). A shorter interval is
   not the way: E1 showed it trips the rate limit and makes a slow boot
   **slower**. Options:
   - the console opens the attach socket as soon as the 201 arrives, and the
     relay holds it until `session.started`, streaming the provisioning
     steps over the same socket;
   - or one server-sent event stream for session state.

   The first option also removes the ticket round trip, and the duplicate
   `attach-ticket` request the trace shows.
3. **Clone with `--filter=tree:0` and check out with `checkout.workers=0`.**
   This halves a cold vscode, from 35 s to 17.5 s (E3), and helps every
   warm-up in 1. The cost is that `git log -- <path>` and `blame` fetch trees
   lazily on first use in a session. Weigh that against `--depth=1`, which is
   faster (11.9 s) but breaks history for the agent until an unshallow.
4. **Do not block the create on `git fetch` when the mirror is fresh.**
   About 0.5 s saved per session (E2). Keep the mirror fresh in the
   background (1 does this), and fetch after launch when it is stale by
   less than a bound.
5. **Keep a spare ready at all times.** Build it at runner boot, not only
   after a create. After a restart, `claim` runs `git status --porcelain` on
   the spare, which takes seconds on a large tree. A second create before
   the spare's `reset --hard` finishes falls back to a full `worktree add`.
6. **Not measured yet:**
   - a signed-in Claude Code boot inside tmux;
   - whether the trust prompt Claude shows in a new directory appears in
     every session, since each worktree is a new path and the runner does
     not pre-accept it;
   - naming with a real LLM, which can hold the 201 for up to 2 s.

## 6. Reproducing

```bash
node scripts/stack/stack.mjs up --web
BOOT_BENCH=1 BENCH_RUNS=3 FLEET_HOSTS=local \
  BENCH_REMOTE=https://github.com/microsoft/vscode.git \
  PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  pnpm --filter @oppenheimer/e2e e2e:fleet tests/fleet/boot-bench.spec.ts
```

Each session prints one JSON line. `marks` are milliseconds after the click
on Send: `post_201`, `navigated`, `server_started` (the row's
`session.started`), `ticket_sent`, `ws_open`, `first_byte`, `agent_drawn`,
`settled`. `steps` are the runner's `session.step` durations.
