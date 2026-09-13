# 12 — Lessons from the reconstructed Grok Bot desktop app

Source: `b-nnett/grok-bot-0.18-reconstructed`, an unofficial
reverse-engineering of a macOS Electron app into readable TypeScript,
archived August 2026. It is a proprietary product rebuilt from its
compiled form, so this note takes ideas from its architecture and no
code. Internal names use the prefix `sand` (sandbox), and a virtual
terminals path under `/root/.cursor/projects/workspace/` suggests the
box runtime was shared with Cursor's background-agent infrastructure.

## 1. How its remote connection works

```
desktop app (Electron main)
  ├─ broker call: ensureSandBox() ──► { gateway URL, bearer token, network token, VNC URLs }
  │     cached as a "gateway descriptor"; env override SAND_HOST_GATEWAY_URL for dev
  ├─ box host connector: HTTP/1.1 + Connect-RPC to the box gateway, Authorization: Bearer
  ├─ egress tunnel: outbound WebSocket from the desktop, so the box's traffic can exit via the user's machine
  └─ VNC edge: a desktop inside the box, proxied to the app for computer use
box ("forever box", one per user, persistent)
  ├─ box host: gateway server + plugin extensions (transcript, inference, automations, MCP, forever-box)
  └─ exec daemon: Connect-RPC over HTTP on 127.0.0.1:1337, bearer "local"
        runs /bin/sh -lc with pipes, no PTY
        background terminals persisted as numbered text files with YAML frontmatter
```

Details worth knowing:

- **Broker, not discovery.** The app never finds the box; it asks a
  broker, gets a descriptor with URL plus two tokens, and caches it. The
  broker can answer with a **blocked hint and a retry-after**, held for
  60 s by default and at most 15 min, and with an **update-required
  hint** that forces a client upgrade before it may connect.
- **Two token headers.** A bearer token for the gateway and a separate
  "network token" header that also unlocks the VNC proxy. Same idea as
  our per-session ticket plus the runner's session token.
- **Forever box.** A persistent per-user box with an image that
  auto-updates. Update means **recreate with `preserveData`**; reset
  means recreate without it. A disk-pressure guard watches the box's
  storage and surfaces it as a status event.
- **Migration is a first-class, resumable stream.** Recreate or move
  emits phases `backing-up → creating → moving → cleaning-up → wiping →
  done | failed`. The client `watch()`es the stream with an **offset
  key**, reconnects every 3 s on drop, declares a stall after 30 s of
  silence, and gives up after 20 reattaches. The last terminal event is
  remembered so a late client still gets the outcome.
- **Recovery is explicit.** `recreateComputer({preserveData, force})`,
  `restartCoordinator()`, `updateForeverBox()`; an epoch counter drops
  stale connect callbacks so a reconnect that lost the race cannot
  overwrite a newer connection.
- **No PTY.** The exec daemon pipes stdio and buffers it; there is no
  resize and no interactive terminal. Long-running shells are written to
  files (`1.txt`, frontmatter, interleaved output, exit footer) that the
  agent reads back as tool results.
- **Local Docker mode.** The same box host and exec daemon can run in a
  loopback-only local container, validated before the coordinator
  connects, with content-addressed artifacts mounted read-only.

## 2. What we take

| Idea | Where it lands |
|------|----------------|
| Descriptor from a broker, cached, with blocked and update-required hints | the control plane's session attach: a ticket that also carries "runner busy, retry after" and "runner too old, update" instead of bare errors |
| Migration as a phased, resumable event stream with offsets and stall detection | host moves (note 10 §4, i7 to AX42), workspace VM recreation on image update, and hibernate-to-wake progress in the session card |
| Update = recreate with data preserved | workspace VM image revisions: recreate the VM from the new golden image, keep the overlay's worktrees and the account volumes, one command |
| Disk-pressure guard as a status event | per-host disk watch, surfaced on the sidebar before a session fails to write |
| Epoch counter on reconnect | the browser-to-relay and runner-to-control reconnect ladders, so a late success cannot clobber a newer connection |
| Background terminals persisted as files with frontmatter | the format for a session's archived scrollback in the event log: header, output, exit footer, readable by humans and agents |
| Loopback local mode with the same daemon | a local dev mode of the runner on a laptop for building the product itself, no VM |

## 3. What we deliberately do not take

- **Pipes instead of a PTY.** Its agents get command output as text;
  ours get a terminal. That is the product difference, and note 01 stands.
- **One forever box per user.** We have one workspace VM per repo plus
  clean VMs, which is finer-grained and matches the worktree UX.
- **VNC in the box for computer use.** Interesting for the Mac Studio QA
  case, but there the agent runs on the Mac itself and drives the
  simulator directly; no VNC hop is needed. Revisit if remote GUI
  sessions ever matter.
- **An egress tunnel through the user's desktop.** It exists so the box
  can reach things only the user's machine can reach. The tailnet gives
  us that without a tunnel: a session's VM can reach a tagged device on
  the tailnet if the host is allowed to, which is a firewall rule, not
  a subsystem.
- **A plugin-extension host.** The gateway is a bus of 34 extensions.
  That is the OpenClaw shape again, and note 00's verdict stands.

## 4. Verdict

The remote connection itself is unremarkable: HTTP with bearer tokens to
a gateway, an exec daemon behind it. What is worth copying is the
operational layer around it, which is where a product like this spends
its second year: brokered descriptors with structured hints, resumable
migration streams, recreate-with-data-preserved updates, disk pressure,
and epoch-guarded reconnects. All of it fits the runner and control
plane as designed, without changing a boundary.
