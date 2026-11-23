---
name: add-coding-agent
description: Add a coding-agent CLI (a new agent a session can run, like Claude Code, Codex, OpenCode, Grok, Pi, Oh My Pi, Antigravity, fx, ZCode, Hermes or Muse) to Oppenheimer the way this codebase does it — its flags read off the CLI's own source, one catalog entry, the runner's launch, probe, install and screen manifest, the console's mark and picker, the chat view, the docs — and prove it live with the real CLI on a real runner. Use it whenever the user asks to add, integrate, support or try a coding agent or agent CLI in sessions ("add Gemini CLI", "can we run Amp", "integrate X's agent", "make Y a session agent", "give Z a chat view"), or to fix how an existing agent launches, resumes, is typed into or reads in the chat, even if they never say "catalog".
---

# Add a coding agent

A coding agent is a CLI the runner starts in a session's tmux window 0. Almost
everything about it is **data in one catalog entry**
(`packages/shared/src/agents/`), which the console reads directly and the
runner reads through generated Go tables. The code is the runner's screen
manifest, an optional chat reader, and the places that list agents by name.

The agents added this way, and what each one taught (read the commit before
copying its shape):

| Agent | Commit | What it taught |
| --- | --- | --- |
| Grok | `83f361787` | the minimal shape; a manifest that trusts only what was seen |
| Pi, Oh My Pi | `3b5d38192`, `c1c5084f5` | an agent family in its own module; no approvals means no `permission`; send Ask even when the CLI defaults to yolo |
| Antigravity | `fd6277d28`, `79ace7978`, `a4dc02789` | an executable named unlike its id needs an installer alias; one label per model id across agents |
| fx | `d577bfe64`, `5ffc607ee`, `3e653460e` | a model id may need its provider pinned; anchor the working rule to the status line, and list every working word |
| ZCode | #985, #994 | no first task on argv; a resume flag that fails; a chat view from a SQLite database; a prompt the agent recalls by itself |
| Hermes | `af020b8eb`, `37ef2996d`, `3887274fe`, `d19b81759`, `788f60f93` | a CLI that is a client of its own gateway, so killing the terminal does not stop the turn; a database reader by column name across versions; compaction writes a conversation twice |
| Muse | `d2644b596`, `6dd44e03f`, `ba75005b3` | an installer that fails half way must not leave a launcher that probes as installed; every picker that starts with a task leaves out an agent that takes none |
| OpenCode (chat) | `9b0c57f9f`, `2cc185b6e`, `075bf1e58`, `15c13b76a` | a chat through the agent's own API; secrets off argv; the session's own conversation among others in its folder; reopen by id |
| Codex, Grok (chat) | `dc675593a`, `c18fdf18d`, `e65405548` | a chat from a transcript file; a new CLI version moves its fields |

Lane: a new agent is new behaviour, so `/propose` (`/cook` picks it). Each step
below runs in the order `steward` writes down.

## 1. Read the CLI, not its docs

Install or build the real CLI and read its **argument parser and TUI source**
(or `--help` and the guide it installs when there is no source). Docs and blog
posts were wrong or stale more than once. Write down, with the version:

- **The binary** and how a person installs it: a release with checksums, an
  npm or Bun package, or nothing (desktop installers only).
- **Model**: the flag, the ids it takes, its default. No `--model` at all means
  the entry lists no models, and a model must never reach argv: a strict parser
  exits on an unknown flag.
- **Permission**: the flag and its values for Ask, Auto and Full access. When
  the CLI's own default is permissive, Ask is still sent (omp). No approvals by
  design means no `permission` (Pi).
- **Effort**: the flag and the levels each model takes.
- **First task**: how an interactive session takes one. A trailing positional
  (Claude Code, Grok), a flag (`--prompt-interactive`, OpenCode's `--prompt`),
  or none: a CLI that reads a positional as a **subcommand** takes no task, and
  one sent would make it exit (ZCode). Never the headless `-p`, which answers
  and exits.
- **Resume**: how a stopped session reopens its conversation, and **what it
  does when there is nothing to reopen**. ZCode's `--continue` exits before its
  TUI starts, so a session restarted before its first message would come back
  with no agent; a flag that fails like that is left out. "The newest in this
  folder" can be another session's when two share a folder (OpenCode); reopen
  by id when the runner can learn it (`conversation.reopen`).
- **Login**: the hosts its sign-in URLs use, and the variable that moves its
  login (`configDirEnv`), if any.
- **Where it keeps the conversation**: a file per session, a local API, or a
  database. This decides the chat view (step 5).
- **Its screen**: the exact strings its TUI draws while a turn runs, at an
  approval dialog, at a question, at sign-in, and idle at its prompt.
- **Its keys**: submit, interrupt, and how to empty its prompt (step 3).
- **Headless output**, for later: `--output-format`, what its `result` line
  carries. The runner's headless drive (16 §Q2) is not built yet.

## 2. The catalog entry

`packages/shared/src/agents/`. Small agents sit in `catalog.ts`; an agent with
a module of its own (`antigravity.ts`, `fx.ts`, `zcode.ts`, `pi-family.ts`) is
composed into `CODING_AGENTS`. Every field's doc comment in
`CodingAgentDefinition` and `CodingAgentLaunch` is the contract; read them.

- Add the id to `CODING_AGENT_IDS` (before `shell`) and the entry to
  `CODING_AGENTS`. Comment each field with where its value was read and the
  version, as the other entries do.
- `models`: the CLI's ids with the console's labels. **A label is per id across
  every agent**: a model another agent already lists reuses that label
  (`a4dc02789`). A gateway id may need its provider pinned in `launch.model`
  (fx's `--provider gateway`).
- `launch.permission` / `effort` / `prompt` / `conversation`: as read in step 1.
  No first task means no `prompt`; then New session lets the task be empty and
  a bot's `start_session`, `runner sessions run` and Plan's Start session
  (`apps/web/src/features/tasks/lib/agent-options.ts`, `takesTask`) leave the
  agent out or refuse it, all derived from the catalog. A new place that
  starts a session with a task asks `takesTask` too, or the task moves to In
  progress while the agent sits idle (`ba75005b3`). Only an agent whose task is a note for the person
  (the blank terminal) says `taskIsNote`.
- `input`: `TYPED_INPUT`, plus `clear` when the agent's prompt can hold text
  nobody left there (step 3), plus `quit` when **the agent's work outlives
  its terminal**: `hermes chat` is a client of Hermes' gateway, which runs the
  turn, so killing tmux only detached and a stopped session kept working.
  `quit` is the lines typed, each then `submit`, before the runner ends the
  terminal (Hermes: `/stop`, `/quit`, `d19b81759`). Check it live: stop a
  session mid-turn and see the work stop.
- `transcriptLocation`, `configDirEnv`, `loginTargets` when they apply.
- **How the runner installs and updates it** goes in `host-setup.ts`, never in
  the catalog: the console loads the catalog on its first page (`22ee3f839`).
  A release goes through `release-install.ts` (checked against the vendor's
  SHA-256 or SHA-512), a registry package through `install-scripts.ts` (npm or
  Bun). Never a script piped into a shell. No terminal release at all: no
  `install`, and the catalog spec's install test names the agent and why.
  An install that fails half way removes what it put on `PATH`: a launcher
  left without its binary probes as installed, and nothing retries
  (`6dd44e03f`).
- Run `pnpm --filter @oppenheimer/shared build`: it writes
  `launch_catalog.gen.go`, `host_tools.gen.go`, `agent_update.gen.go` and
  `protocol-schema/protocol.schema.json`. The link only grows, and a new enum
  value is allowed: an old runner never probes the new binary, and the API
  refuses an agent the host's tool inventory lacks (`SESSIONS_011`).

## 3. Typing into it

Three paths type a message into an agent: the console's chat composer
(`SessionChat.send`), the API's prompt typer (`promptTyping`, for bots, wakes
and `opp prompt`), and the runner's `Children.Tell` (child sessions and their
reports to the parent). All three read the catalog's `input`, and its `clear`
only through `clearOf(agent)`; never write an agent's keys or timing into one
of them.

- Find out how the TUI empties its prompt (ZCode: Ctrl+U; never Ctrl+C, which
  counts towards quitting), and whether **anything puts text in it the person
  did not leave there**. ZCode recalls its last prompt on an Up arrow into an
  empty prompt; an approval dialog's Up or a wheel over the terminal sends one.
  If so, set `input.clear: { keys, settleMs }`.
- `settleMs` exists because the clear and the words must **not arrive in one
  burst**: a TUI that applies the clear on its next render inserts the words
  into the prompt it has not emptied yet (ZCode: 100). The chat and `Tell`
  wait it out; the API spaces the whole message by it. A message whose files
  were just pasted is not cleared over them.
- Prove it live: recall a prompt into the agent's input, send from the chat
  and through `POST /sessions/{id}/prompt`, and read what the agent stored.

## 4. The runner

- `internal/sessions/domain/session.go`: the `Agent` constant and its
  `agentCatalogIDs` row (and the comment listing the agents).
- `internal/host/domain/facts.go`: the `Tool` constant (the binary's name) and
  `ProbedTools`.
- `cmd/runner/main.go`: the agent in `sessions new --agent`'s help, and in
  `sessions run --agent`'s only when the agent takes a task.
- **The screen manifest**, `internal/sessions/adapters/manifest/manifests/<agent>.json`:
  - Rules come from strings in the CLI's source or seen live, each with a
    `note` saying where and on which version; `notes` says what is not yet
    watched.
  - A working rule is anchored to the status line, not to any line that
    starts with the word: fx's "Working" matched a reply saying "Working tree
    is clean". List every word the status line takes (fx also says
    "Thinking", which read as unknown mid-turn).
  - Give the idle prompt a rule too. A dialog that reads as `unknown` for one
    sample resets the 30 seconds the API waits before a blocked session
    counts as waiting on you.
  - The raw PTY stream splits words with cursor moves, so check a pattern
    against what `tmux capture-pane -p` shows, not against bytes.
- Add the agent to `TestBundledManifestsLoad`'s list, a launch test in
  `launch_test.go` for its argv (a model or a task it does not take adds
  nothing; Ask is sent; a restart sends the right resume), and the updater
  and install tests' lists when it has those.
- `scripts/runner/install.sh`: the binary in `KNOWN_AGENTS` and its usage
  line, and **an alias when the agent id is not the binary's name**
  (`antigravity` → `agy`); `apps/api/src/hosts/infrastructure/runner-release.config.ts`'s
  Add host prompt lists the same names. A missed alias stopped a pairing
  (`79ace7978`).

## 5. The chat view

The runner turns the agent's conversation into the transcript lines the
console already draws (Claude Code's shape, `claude_chat.go`); nothing in the
console changes. Pick the source by where the agent keeps it:

| The agent keeps | Read it with | Example |
| --- | --- | --- |
| a file per conversation | a `chatSource` in `transcript/` (finder + transcriber) | `codex.go`, `grok.go` |
| a local API | an `openCodeStore` over that API | `opencode_api.go` |
| a database in OpenCode's shapes | an `openCodeStore` over the file, read-only | `zcode.go` |
| a database of its own | a store over the file, read-only | `hermes.go` |

- **Find the session's own conversation**: in its directory, touched since the
  session launched, never another session's in the same folder (OpenCode,
  `075bf1e58`), never an internal thread the CLI writes beside it (Codex's
  reviews and compactions, `e65405548`).
- **Leave out what the person never sees** (system reminders, environment
  messages, model-only rows), and do it **before** any window or limit: ZCode
  writes six hidden rows a turn, and a "last 20" window that dropped them after
  the read took a short window for the whole conversation and lost a burst of
  turns (`b92eac989`).
- **A database the agent owns is not a schema you own.** Read rows by column
  name and tolerate a column an older version lacks (Hermes before
  `transcript_revision`, `788f60f93`); never build SQL from text, pass a list
  as one JSON parameter read with `json_each` (`3887274fe`, gosec G202); check
  every `Close`. When the agent compacts, it may archive rows and write the
  turns it keeps again: fold each message's copies as the agent does, or the
  chat shows them twice.
- **Open the agent's files read-only** and never change them. A database is
  opened `mode=ro`; one that does not exist yet is "nothing said yet", not a
  failure. A third-party module the runner confines (`modernc.org/sqlite`)
  needs its new owner in `internal/arch`'s `confined` table and in
  `ARCHITECTURE.md`.
- **Secrets stay off argv**: a password for the agent's API goes in the
  session's tmux environment, not on the command line every account can read
  (`2cc185b6e`).
- **Test against real samples.** Record the rows or lines a real session
  writes (one with a tool call) and test the reader on them. A CLI's next
  version moves fields (Codex 0.167, `c18fdf18d`): when the store's shape is
  undocumented, say so in the reader and in the changeset.
- The guide's Sessions page names which agents have a chat; the runner's
  README says which answer `transcript.read`.

## 6. The console and the docs

- `packages/frontend/design-system/web/src/components/agent-mark.tsx`: the
  agent's mark from its published brand asset (or a mark it shares, as ZCode
  wears Z.ai's), its line in the doc comment, and its source in
  `packages/frontend/design-system/AGENTS.md`. With none, it draws the bot
  glyph.
- `apps/web/src/features/sessions/lib/agent-choices.ts`: a new agent is off in
  New session until switched on in Settings → Agents; name it in the comment
  above `OFFERED_BY_DEFAULT`. Settings → Agents lists every catalog agent on
  its own.
- `pnpm generate:api-client` (the agent enum reaches the OpenAPI document).
- The guide (`apps/docs/docs/guide/`): `overview.md`, `faq.md`, `sessions.md`
  (picker, chat line), `hosts.md` (the install list, or why it is not
  offered); then `pnpm generate:guide`. The runner README's install list.
- A changeset naming every package touched.
- Screenshots, light and dark: `/settings/agents` and New session with the
  agent picked (`local-stack`, "Show a visual change").

## 7. Prove it live

Unit tests and a stand-in binary prove the wiring; only the real CLI proves
the flags, the screen strings and the chat. Do both.

1. **The real CLI on this machine.** Build or install it somewhere every
   account can read (`/opt/<agent>`), with a wrapper that gives it this
   sandbox's proxy and CA (`HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS`, or the CLI's
   own variables such as `ZCODE_HTTP_PROXY`). The proxy's port changes when
   the session's worker restarts: refresh the wrapper before each run.
   Running a downloaded project's install scripts needs the user's go-ahead.
2. **Its key** through `request_credential` for the model API's host, never
   pasted in chat; the CLI's own config gets a placeholder key the proxy
   replaces. Check it with one headless call first.
3. **A real runner**: the fleet on this machine,
   `cd e2e && E2E_FLEET=1 FLEET_HOSTS=local npx playwright test --project=fleet <throwaway spec> --reporter=list --trace off`,
   with the stack up (`node scripts/stack/stack.mjs up --web`). In the spec:
   `pairedHosts`, then as the host user put the wrapper on `~/bin` and the
   CLI's config in its home, `killRunner()` so it probes again, and poll
   `GET /hosts` until its tools list the binary; then
   `createSession(api, hostId, installationId, { agent, launch: { permission } })`.
4. **Drive it like a person**: type into `.xterm`, read the screen from
   `.xterm-rows` (not the raw socket bytes), switch Terminal → Chat with the
   "How to read this session" group, send from the chat composer, and check
   what the agent itself stored (its database or transcript, read as the host
   user) as well as what the chat shows. Cover an approval dialog, a restart,
   and a message from the chat after the agent recalled or kept text in its
   prompt.
5. Delete the throwaway spec. Screenshots go to the user and the pull request.

Then the fresh verifier of `steward` and `ship` gets the same recipe in its
brief, so it can run the real CLI too.

## 8. Before the pull request

- `pnpm --filter @oppenheimer/shared check:generated`, the runner's
  `go test ./internal/sessions/... ./internal/host/... ./internal/arch/...`,
  the shared `src/agents` specs, then `pnpm ci:local`.
- Another agent landing on `main` meanwhile conflicts in every list above:
  merge `main` in and keep both, then rebuild the generated files rather than
  resolving them by hand. Two catalog fields added at once (`clear`, `quit`)
  meet in `input.go` and the emitter: keep both. After the merge, look at
  `agent-mark.tsx` whole: a union of two SVG cases cut a mark's closing tags
  twice (`7bc18337f`, `dfdb86b47`).
- The description says what was watched live and what was only read from the
  source, and lists what is left (a sign-in rule not yet seen, subagents the
  chat does not show yet, a schema the reader depends on).
