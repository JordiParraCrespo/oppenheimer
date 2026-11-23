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

This file is the process. The why behind each rule, with the commit that
learnt it, is `references/lessons.md`, filed by step: read a step's section
there when the step raises a question, and add what this integration learns
to it. Its table names the agent whose commit is the closest shape to copy.

Lane: a new agent is new behaviour, so `/propose` (`/cook` picks it). The
steps run in the order `steward` writes down.

## 1. Read the CLI, not its docs

Install or build the real CLI and read its **argument parser and TUI source**
(or `--help` and the guide it installs when there is no source). Write down,
with the version:

- **The binary**, and how a person installs it: a release with checksums, an
  npm or Bun package, or nothing.
- **Model**: the flag, the ids, the default. No `--model` means no models.
- **Permission**: the values for Ask, Auto and Full access. Ask is sent even
  when the CLI's default is permissive; no approvals means no `permission`.
- **Effort**: the flag and the levels each model takes.
- **First task** in an interactive session: a trailing positional, a flag, or
  none (a positional that is a subcommand, or one that runs headless, counts
  as none). Never the headless `-p`. Try a task that starts with `-`: a parser
  that reads it as a flag needs the `--flag=<task>` form.
- **Resume**: how a stopped session reopens its conversation, and **what it
  does when there is nothing to reopen yet** (a restart before the first
  message): run it. A by-id flag the runner learns goes in the existing
  `conversation.reopen`, not a new field.
- **Login**: the host of the URL the person is shown (not the API's base),
  and the variable that moves the login.
- **Where it keeps the conversation**: a file per session, a local API, a
  database (step 5).
- **Its screen**: the strings it draws mid-turn, at an approval, at a
  question, at sign-in, and idle, **seen in tmux**, not only read in the
  bundle. With no key yet, point the CLI at a fake OpenAI-compatible server
  on loopback that scripts a tool call, and watch every state.
- **Its keys**: submit, interrupt, empty the prompt (step 3).
- **Whether its work outlives its terminal** (a client of its own server or
  gateway).
- **Its updater, run on the install the runner makes**: one that prints
  instructions and exits 0 is no updater; one that updates itself at launch
  may write somewhere else.
- **What turns its transcript off** (a setting that disables recording takes
  the chat and resume with it).

## 2. The catalog entry

In a module of its own beside `catalog.ts` (`hermes.ts`, `muse.ts`), composed
into `CODING_AGENTS`. The doc comments on `CodingAgentDefinition` and
`CodingAgentLaunch` are the contract.

- The id in `CODING_AGENT_IDS` (before `shell`). Comment each field with where
  its value was read, and the version.
- `models`: a model another agent lists keeps that agent's label. A gateway
  id may pin its provider in `launch.model`. Levels several agents share go
  in `effort-levels.ts`.
- `launch.permission` / `effort` / `prompt` / `conversation` as read, with a
  `launch_test.go` case for a task that starts with `-`. No first
  task means no `prompt`. New session, bots, `sessions run`, Plan's Start
  session (`takesTask` in `apps/web/src/features/tasks/lib/agent-options.ts`)
  and automations (`automation-agent.policy.ts`, `automation-draft.ts`) derive
  from it; add the agent to their comments. `taskIsNote` is the blank
  terminal's alone.
- `input`: `TYPED_INPUT`; `clear` when the prompt can hold text nobody left
  (step 3); `quit` when the work outlives the terminal (the lines that end
  it, each then `submit`).
- `transcriptLocation`, `configDirEnv`, `loginTargets` when they apply.
- Install and update in `host-setup.ts`, never the catalog: a checksummed
  release (`release-install.ts`) or a registry package
  (`install-scripts.ts`), never a script piped into a shell. `update` only
  for an updater seen working on that install. A failed install
  removes what it put on `PATH`. No terminal release: no `install`, and the
  catalog spec's install test names the agent and why.
- A field the catalog lacks is three edits: `catalog.ts`, its line in
  `scripts/emit-agent-catalog.cjs` (emitted only for agents that set it), and
  the Go that reads it (`internal/sessions/domain/input.go` or `launch.go`),
  with a runner test.
- `pnpm --filter @oppenheimer/shared build` writes `launch_catalog.gen.go`,
  `host_tools.gen.go`, `agent_update.gen.go` and the protocol schema. The new
  enum value is a compatible change: an old runner sends no entry for the
  command, which the API refuses (`SESSIONS_011`).

## 3. Typing into it

Three senders: the console's chat (`SessionChat.send`), the API's
`promptTyping` (bots, wakes, `opp prompt`) and the runner's `Children.Tell`.
They read `input` from the catalog: TypeScript through `clearOf(agent)`, the
runner through `Agent.Input()`. Never put an agent's keys or timing in one of
them.

- Find the key that empties the prompt (not one that counts towards quitting)
  and whether **anything puts text there the person did not**. If so,
  `input.clear: { keys, settleMs }`, with `settleMs` the time the TUI takes to
  act on it.
- Prove it live: put text in the agent's prompt the way it does, send from the
  chat and through `POST /sessions/{id}/prompt`, and read what the agent
  stored.

## 4. The runner

- `internal/sessions/domain/session.go`: the `Agent` constant, its
  `agentCatalogIDs` row, the comment listing agents.
- `internal/host/domain/facts.go`: the `Tool` constant and `ProbedTools`.
- `cmd/runner/main.go` help: `sessions new --agent`; `sessions run --agent`
  only if it takes a task; `agents install <name>` only if the runner installs
  it.
- **The manifest**, `internal/sessions/adapters/manifest/manifests/<Agent>.json`,
  named by the runner's `Agent` value (`claude.json` for `claude-code`). Each
  rule from the CLI's source or seen live, with a `note` saying where and on
  which version; `notes` says what is not yet watched. The working rule is
  anchored to the status line and lists every word it takes; the idle prompt
  has a rule; patterns are checked against `tmux capture-pane -p`.
- Tests: `TestBundledManifestsLoad`'s list; a `launch_test.go` case for argv
  (what it does not take adds nothing, Ask is sent, a restart resumes right);
  if the runner installs it, `TestInstallScriptsByKindAndPlatform` and
  `TestOnlyUnattendedAgentUpdatersAreRun` (`false` for one that updates
  itself).
- If the runner installs it: `KNOWN_AGENTS` and the usage line in
  `scripts/runner/install.sh`, with an alias when the id is not the binary's
  name; the Add host prompt in
  `apps/api/src/hosts/infrastructure/runner-release.config.ts`; the runner
  README's `runner agents install` row.

## 5. The chat view

The runner turns the agent's conversation into the transcript lines the
console already draws (`claude_chat.go`'s shape); the console does not change.

| The agent keeps | Read it with | Example |
| --- | --- | --- |
| a file per conversation | a `chatSource` (finder + transcriber) | `codex.go`, `grok.go` |
| a local API | an `openCodeStore` over the API | `opencode_api.go` |
| a database in OpenCode's shapes | an `openCodeStore` over the file | `zcode.go` |
| a database of its own | a store over the file | `hermes.go` |

- **Wire it in**: an `Options` field and a source on `Reader` in
  `transcript.go`; the path from `internal/cli/app.go` (`agentHomeFile`,
  honouring the agent's home variable); a `chats[...]` entry for a file
  source, or a branch in `follow.go` and `page.go` for a store.
- **Only this session's conversation**: in its directory, since it launched,
  never a neighbour's or an internal thread the CLI writes beside it.
- **Hidden rows out, before any window or limit.**
- **Read-only**: a database opened `mode=ro`, a missing one is "nothing said
  yet", columns read by name, no SQL built from text (a list is one JSON
  parameter with `json_each`), every `Close` checked, compaction copies folded
  as the agent folds them. `modernc.org/sqlite` is confined to
  `sessions/adapters/transcript`; a reader elsewhere needs a `confined` row in
  `internal/arch` and a line in `ARCHITECTURE.md`.
- **Secrets off argv**: in the session's tmux environment.
- **Tested on samples a real session wrote**, one with a tool call. Say in the
  reader when the store's shape is undocumented.
- The guide's Sessions page and the runner README name the agents with a chat.

## 6. The console and the docs

- `agent-mark.tsx` (design system): the mark from the agent's published brand
  asset, its line in the doc comment, its source in
  `packages/frontend/design-system/AGENTS.md`. With none, the bot glyph.
- `apps/web/src/features/sessions/lib/agent-choices.ts`: off in New session
  until switched on in Settings → Agents; name it above `OFFERED_BY_DEFAULT`.
- `pnpm generate:api-client`.
- The guide (`apps/docs/docs/guide/`): `overview.md`, `faq.md`, `sessions.md`,
  `hosts.md`; then `pnpm generate:guide`.
- A changeset naming every package touched.
- Light and dark screenshots of `/settings/agents` and New session with the
  agent picked (`local-stack`, "Show a visual change").

## 7. Prove it live

Unit tests and a stand-in prove the wiring; only the real CLI proves the
flags, the screen and the chat.

1. **The real CLI**, built or installed where every account can read it
   (`/opt/<agent>`), behind a wrapper with this sandbox's proxy and CA
   (`HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS` or the CLI's own variables). Refresh
   the proxy port before each run. A downloaded project's install scripts need
   the user's go-ahead.
2. **Its key** through `request_credential` for the model API's host, never
   from chat; the CLI's config gets a placeholder the proxy replaces. One
   headless call checks it.
3. **A real runner**: with `node scripts/stack/stack.mjs up --web`, a
   throwaway spec run by
   `cd e2e && E2E_FLEET=1 FLEET_HOSTS=local npx playwright test --project=fleet <spec> --reporter=list --trace off`.
   In it: `pairedHosts`; as the host user, the wrapper on `~/bin` and the
   CLI's config in its home; `killRunner()`; poll `GET /hosts` until the
   tools list the binary; `createSession(api, hostId, installationId, { agent, launch: { permission } })`.
4. **Drive it like a person**: type into `.xterm`, read `.xterm-rows`, switch
   to Chat ("How to read this session"), send from the composer, and read what
   the agent stored as the host user. Cover an approval, a stop mid-turn, a
   restart, and a message after text was left in the prompt.
5. Delete the throwaway spec; the screenshots go to the user and the PR.

What stays committed is a **stand-in**: `e2e/fleet/<binary>` drawing the
agent's screen and writing its conversation as the real one does, its `COPY`
in `e2e/fleet/Dockerfile`, its name in `SHIMS` (`e2e/support/fleet-local.ts`),
and a fleet spec for what it adds (`hermes-chat.spec.ts`, `agents.spec.ts`).
The fresh verifier gets this recipe in its brief.

## 8. Before the pull request

- `pnpm --filter @oppenheimer/shared check:generated`; the runner's
  `go test ./internal/sessions/... ./internal/host/... ./internal/arch/...`;
  the shared `src/agents` specs; `pnpm ci:local`.
- Another agent landing meanwhile conflicts in every list above: merge `main`,
  keep both sides, rebuild the generated files, and read `agent-mark.tsx`
  whole afterwards.
- The description says what was watched live and what was only read, and
  what is left.
- New lessons go in `references/lessons.md` under their step.
