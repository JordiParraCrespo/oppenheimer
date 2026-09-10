# Oppenheimer — research notes and initial plan

Status: research phase. Nothing in this repo is code yet. This document is the
starting point for a discussion, not a spec.

## 1. What we are building

A web platform where you log in, pick a project, describe a task, choose
**where** it runs (a Linux server, a Mac Studio, a cloud VM), choose **which
secrets** the run may use, and the platform spins up an isolated workspace
on that machine, runs a coding agent inside it, and streams the session back
to the browser. Many of these can run in parallel, and one run can delegate
to others.

Short version: *Claude Code on the web, but you own the fleet of machines
it runs on, and it is multi-agent.*

Scope for the MVP is software development only. Customer support and other
verticals are explicitly out until the core loop is boring and reliable.

## 2. What we learned from the tools we tried

### OpenClaw — why it failed for us

OpenClaw is a general-purpose personal-agent framework: a central gateway,
15+ chat channels, a skills marketplace, memory, plug-ins, and local
execution, all in one process. Four days were lost just getting it to build
and run. The reasons are structural, not bad luck:

- It solves a different problem (an always-on assistant reachable from
  WhatsApp/Telegram/etc.), so 80% of its surface is dead weight for us.
- Trust boundaries are scattered across layers. An independent security
  analysis found exec allowlists bypassable by shell parsing tricks,
  authorization keyed on spoofable display names, and unverified skill
  supply chain. That is what "too large" looks like in practice.
- Everything is coupled, so nothing can be adopted piecemeal.

Lesson: **do not build a framework. Build a thin product over a harness we
do not own.**

### Orca — why it feels right

Orca (Stably AI, MIT, Electron) is an "agent development environment": it
runs many CLI agents (Claude Code, Codex, Gemini, 25+) in parallel, each in
its own git worktree, and does **not** modify the agents at all. It wraps the
environment around them. It supports SSH worktrees on remote machines, task
manager integrations, and cron automations. It went from first commit
(March 2026) to 50k+ stars in five months, which says the shape is right.

What Orca gets right and we should copy:

- The agent harness is a black box. Bring your own Claude Code login or API
  key. No proxying through the vendor.
- Isolation unit is the worktree, which is cheap and understood.
- Parallelism is the product. The UI is a cockpit, not a chat window.

What Orca is *not*, and where we differ:

- It is a desktop app. State lives on one laptop. We want a server-side
  control plane so the fleet is reachable from any browser and runs survive
  closing the lid.
- "SSH worktree" is remote execution without a real runtime: no
  containers, no secret scoping, no per-run environment. We want a runner
  daemon on each target that provisions a proper sandbox.
- No orchestration layer beyond handoffs. We want tasks that fan out and
  come back.

### The reference: Claude Code on the web and Managed Agents

Anthropic's own hosted product is the closest thing to what we want, and
its domain model is worth copying wholesale because the Agent SDK already
speaks it:

- **Environment**: a machine/network policy/setup script definition.
- **Session**: one agent conversation, backed by an ephemeral container
  cloned fresh from the repo.
- **Multiagent orchestration**: a coordinator agent in a primary thread
  spawns sub-agents as **session threads** that share the sandbox,
  filesystem, and vault credentials but have isolated context. Threads are
  persistent, so the coordinator can send follow-ups.
- **Vaults**: credentials injected into the sandbox, never into the model's
  context.
- **Triggers/Routines**: cron or webhook that starts a fresh session.

The difference is that Anthropic runs the sandbox. In our product the user
runs the sandbox on their own machines. Everything else can rhyme.

## 3. Architectural thesis

Three layers, each replaceable, with a very deliberate line about what we
build and what we borrow:

```
┌──────────────────────────────────────────────────────────────┐
│  Web app (browser)                                           │
│  projects · tasks · targets · secrets · live session view    │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTPS + SSE/WebSocket
┌──────────────▼───────────────────────────────────────────────┐
│  Control plane (one stateless service + Postgres)            │
│  auth · domain model · scheduler · event log · secret vault  │
└──────────────┬───────────────────────────────────────────────┘
               │ outbound WebSocket from each runner (no inbound ports)
┌──────────────▼──────────┐  ┌──────────────────────┐  ┌──────────────┐
│ Runner on Linux server  │  │ Runner on Mac Studio │  │ Runner on VM │
│  workspace provisioning │  │  (same binary)       │  │  (same)      │
│  agent harness process  │  │                      │  │              │
└─────────────────────────┘  └──────────────────────┘  └──────────────┘
```

**We build**: the web app, the control plane, the runner daemon, the
workspace provisioner, and the secret injection path.

**We borrow**: the agent itself. The runner launches Claude Code through the
Claude Agent SDK (TypeScript) and streams its event stream up. Sub-agent
spawning, tool use, permissions, MCP, skills, hooks, and context management
all come for free. We never re-implement an agent loop. If a second harness
(Codex, Gemini CLI) is wanted later, it is one more adapter behind the same
runner interface, the way Orca does it.

### Why runners dial out

The Mac Studio behind a home router and the server in a datacenter are the
same case: the runner opens one outbound WebSocket to the control plane,
authenticates with a per-target token, and receives jobs. No port
forwarding, no SSH key distribution, no inbound firewall rules. This is the
single biggest usability difference versus Orca's SSH model.

### Isolation ladder

The runner supports increasing isolation, chosen per target:

| Level | Mechanism | Use when |
|-------|-----------|----------|
| 0 | git worktree in a fresh directory | trusted machine, fastest, Mac-friendly |
| 1 | Docker/OrbStack container with the worktree mounted | default for servers |
| 2 | microVM (Firecracker) or cloud VM per run | untrusted code, later |

MVP ships levels 0 and 1. Level 2 is a target type, not a rewrite.

### Secrets

- Stored in the control plane, envelope-encrypted with a KMS or a master
  key, scoped to a project and optionally to a target.
- When a run starts, the user (or the task template) selects which secrets
  the run may see. Only those are sent to the runner, over the authenticated
  channel, and injected as environment variables or files into the workspace.
- Secrets never enter the model's prompt. The agent sees `$GITHUB_TOKEN`,
  not the value. Output streams are scrubbed for known secret values as a
  second line of defense.
- The Claude credential itself is just another secret on the target
  (API key or OAuth token), so BYOK works like Orca.

### Multi-agent, without inventing a DSL

Two levels, and only the first is in the MVP:

1. **Fleet parallelism**: N independent sessions on N workspaces, possibly
   on different targets, visible in one board. This is what Orca proved
   people want. It needs zero orchestration logic beyond a scheduler.
2. **Delegation**: a session can create child sessions via a platform tool
   exposed to the agent through MCP (`spawn_task`, `wait_task`,
   `send_message`). Children get their own workspace and stream. The
   coordinator is just an agent with that MCP server enabled. This mirrors
   Managed Agents' thread model and this very environment's
   `create_session`/`send_message` tools. No graph editor, no YAML
   pipelines. The model plans; the platform provides primitives.

## 4. Domain model (first cut)

- **User / Org**: login, membership, API tokens.
- **Project**: a git repo URL plus default branch, default target, and
  setup script (the equivalent of a CLAUDE.md-era environment definition).
- **Target**: a machine registered by running the runner. Has capabilities
  (os, arch, docker available, isolation levels supported), a token, and an
  online/offline heartbeat.
- **Secret**: name, encrypted value, project scope, optional target scope.
- **Task**: user intent. Title, prompt, project, chosen target, chosen
  secrets, isolation level, branch naming rule. Can be created from the UI,
  API, or a trigger (webhook, cron, GitHub issue).
- **Session**: one agent run for a task on one workspace. Has a status
  machine (queued → provisioning → running → waiting_for_input → done /
  failed / cancelled), a parent session if delegated, and a branch/PR link.
- **Event**: append-only log per session. Agent SDK messages, tool calls,
  tool results, provisioning logs, cost. The browser replays and tails this.
- **Workspace**: ephemeral. Path on the target, worktree or container id,
  created on session start, garbage-collected after a retention window.

## 5. Recommended stack

One language end to end so a two-person team can move: **TypeScript**.

- Monorepo with pnpm workspaces and Turborepo.
- `apps/web`: Next.js (App Router), shadcn/ui, live session view over SSE.
- `apps/control`: Hono or Fastify on Node, Postgres via Drizzle, one
  WebSocket hub for runners. Stateless so it can run anywhere.
- `apps/runner`: Node daemon, single binary via `pkg`/`bun build`, uses
  `@anthropic-ai/claude-agent-sdk` to run sessions and Dockerode for level-1
  isolation. Installs with one curl command that embeds the target token.
- `packages/protocol`: zod schemas shared by all three (job, event, secret
  bundle, heartbeat). This is the only contract that matters.
- Auth: Better Auth or Clerk. GitHub OAuth first since projects are repos.
- Streaming: Postgres `LISTEN/NOTIFY` or a small Redis for fan-out from
  runner → control → browser. Redis is optional at MVP scale.

Rejected: Python for the runner (SDK parity is fine but a second toolchain
on user machines hurts installation), Electron (state must live server-side),
Kubernetes (targets are pets, not cattle, at this stage).

## 6. MVP definition and phases

**MVP done means**: from a browser, on a project with a registered Linux
server and a registered Mac Studio, you can create three tasks, run them in
parallel on different targets, watch them live, answer a permission prompt,
and each ends in a branch pushed to GitHub with a PR opened. Secrets are
scoped per task and never appear in logs.

| Phase | Deliverable | Notes |
|-------|-------------|-------|
| 0 | Repo skeleton, protocol package, ADRs | this doc → `docs/adr/` |
| 1 | Runner + WS hub + xterm.js page: a persistent terminal on a remote target from a browser | see `01-terminal-first.md` §6 |
| 2 | Control plane + runner WebSocket: register target, dispatch job, persist events | no UI, curl only |
| 3 | Web app: login, project, target list, task create, live session tail | first thing you can demo |
| 4 | Secrets vault + scoped injection + log scrubbing | before any real credential touches it |
| 5 | Level-1 Docker isolation, branch/PR automation, task board with N parallel sessions | the Orca moment |
| 6 | Delegation MCP server (`spawn_task`, `wait_task`) | multi-agent |
| 7 | Triggers: webhook, cron, GitHub issue label | automation |

Phase 1 is the risk-retirement step. If the remote terminal does not feel
as smooth as Orca over SSH, nothing else matters, so we want to know in
week one, not week six.

## 7. Decisions I would make now, and why

- **Terminal first, not the Agent SDK.** Superseded after discussion, see
  `01-terminal-first.md`. The core primitive is a real PTY in the browser;
  any CLI agent (`claude`, `codex`) runs unmodified inside it. The SDK is a
  later add-on for unattended runs.
- **Agent-agnostic by construction.** Because the unit is a terminal,
  Claude and Codex both work on day one with no adapters.
- **Events are the source of truth.** Session state is derived from the
  event log. This gives replay, resume after runner reconnect, and audit
  for free.
- **No plugin or skills marketplace.** Skills are files in the repo
  (`.claude/skills`), which the harness already loads. OpenClaw's supply
  chain problem is not one we need to have.
- **Interactive permissions from the browser.** A run that hits a
  permission prompt goes to `waiting_for_input` and the browser gets a
  button. Auto-approve modes are per task, off by default.

## 8. Open questions for discussion

1. **Who is the user on day one?** Only us, or other developers too? This
   decides whether multi-tenant auth and billing are in phase 3 or phase 9.
2. **Claude credentials on targets: subscription OAuth or API key?** OAuth
   is cheaper for heavy use but is tied to a human login on that machine.
   API key is simpler to inject as a secret. Probably support both, default
   to API key.
3. **Hosted control plane or self-hosted?** The runner model works for
   both. Self-hosted first (docker compose) keeps us honest about
   simplicity, which is the OpenClaw lesson.
4. **Do child sessions share a workspace with the parent or get their own?**
   Managed Agents share the filesystem. Orca gives each a worktree. Shared
   is simpler for "fix these three files"; separate is safer for "try three
   approaches". Likely: separate by default, shared as an option.
5. **How much of the Claude Code UI to replicate?** Diff view and permission
   prompts are essential. A Monaco editor and embedded browser are Orca
   features that can wait.
6. **Name.** "Nation orchestrator" is the idea; the repo is `oppenheimer`.
   Pick one before the protocol package is named.

## 9. Proposed repo layout

```
oppenheimer/
├── apps/
│   ├── web/          # Next.js
│   ├── control/      # API + runner hub
│   └── runner/       # daemon installed on targets
├── packages/
│   ├── protocol/     # zod schemas: jobs, events, heartbeats, secret bundles
│   ├── db/           # drizzle schema + migrations
│   └── ui/           # shared components
├── docs/
│   ├── research/     # this file and follow-ups
│   └── adr/          # one file per decision from section 7
└── docker-compose.yml
```

## Sources

- Orca: <https://github.com/stably-ai/orca>,
  <https://agentconn.com/blog/orca-ade-agent-fleet-parallel-coding-agents-2026/>
- OpenClaw architecture: <https://vallettasoftware.com/blog/post/openclaw-architecture-diagram-2026>
- OpenClaw security analysis: <https://arxiv.org/html/2603.27517v3>
- Claude Managed Agents multiagent orchestration:
  <https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration>
- Claude Code on the web: <https://code.claude.com/docs/en/claude-code-on-the-web>
- Agent orchestrator landscape: <https://github.com/andyrewlee/awesome-agent-orchestrators>
