# The bot stack as software: an audit, a survey of agent SDKs, and a plan (2026-11-17)

The owner asked for a read of all the bots' code. His worry: the software
that runs agents, here and across the industry, ends up as spaghetti,
because underneath it builds one long string and parses what comes back.
He asked what a well-engineered version looks like (layers, ports,
adapters), with the agent SDKs that exist read first, and then a plan to
refactor ours.

This note is that read. It decides nothing: §4 is a proposal and §5 its
order of work, each slice a pull request of its own under `/propose`. The
design that governs today is `design/bots/bots.md`. Code paths are from
the repository root.

What is measured and what is inferred:

- **Measured** (§1): counted on `main` at `07516cb4` with `wc`, `grep` and
  a read of the files named. Line counts leave out `*.spec.ts`.
- **Read** (§2): each SDK's and project's public documentation and source,
  on 2026-11-17, with the address beside each claim. Nothing was run.
- **Inferred** (§3, §4): what the two add up to. Marked as such.

## 0. The answer in short

1. **The core is not spaghetti.** The engine port, the stream contract, the
   event reducer and the tool specification are sound, and better than what
   most open harnesses have. They stay.
2. **Four structures are real but implicit**, and that is what reads as
   spaghetti: the prompt is a list of sections nobody declared as one; a
   tool call passes through six wrappers nobody listed; a tool's result is
   several channels pressed into one string and one string map; and one
   module owns the runtime, eight product features and every other
   module's tools.
3. **No SDK fixes this, and none should be adopted as the runtime.** Every
   one of them leaves prompt assembly, the tool catalog and permissions to
   the application, which is where our tangle is. What they offer is
   vocabulary: sections with a stability, toolsets with an activation rule,
   middleware around a call, a typed result, a run described as data. The
   "directives" the owner remembered are Vercel's Workflow SDK, which
   splits orchestration from effects; the Vercel product that splits an
   agent's prompt into pieces is eve, as files (§2.1).
4. **The plan is to name those four structures as types** in a small
   kernel with no framework in it, then move code onto them one slice at a
   time, with the existing specs and the eight bot evals as the net. No
   behaviour changes until slice 6.

## 1. What is there

### 1.1 Size

| Where | Files | Lines | Specs |
| --- | --- | --- | --- |
| `packages/backend/agents` (the engines) | 17 | 2,900 | 3,100 |
| `packages/backend/llm` (one completion, over `fetch`) | 15 | 800 | 350 |
| `apps/api/src/bots` (the bot, its documents, memory, credentials) | 178 | 8,900 | 3,000 |
| `apps/api/src/bots-chat` (turns, tools, everything else) | 399 | 42,500 | 28,800 |

`bots-chat` holds 40 command slices, 18 query slices, 52 domain policies
(7,200 lines), 30 tool factories that declare 128 tools, and 25 mappers at
the module's root (3,800 lines) that write what a tool answers. Its module
file has 227 imports and registers about 200 providers.

### 1.2 What is sound, and stays

- **One port over the vendors.** `BotEngine.run(request)` answers a stream
  of nine event types; `packages/backend/agents` is the only importer of
  either SDK, and `pnpm check:public-api` holds that no SDK type leaves it.
- **A contract the stream cannot break.** `guardTurn` wraps every engine:
  nothing is thrown, exactly one `done` ends the turn, an abort is
  `cancelled` at once, and the key and the scratch directory are redacted
  from every text, across delta boundaries.
- **The transcript is a reducer.** `TurnTranscript.apply(event)` answers
  the writes an event asks for and does none itself; the handler that runs
  a turn is 116 lines.
- **A tool is declared, not coded.** `defineBotTool` takes a name, a
  description, a zod input and traits (`scope`, `asks`, `readOnly`,
  `perCallOnly`, `escalates`, `notOn`, `attendedOnly`, `subject`,
  `summarize`, `normalize`), and the prompt's list of tools is read from
  the same definitions the turn is offered.
- **The prompt is built for the cache.** `composeBotSystemPrompt` is the
  same bytes every turn while the bot does not change; the facts of the
  moment (the time, the hosts) open the turn's message in a block the
  prompt tells the model to trust.
- **Eight evals** of a bot's behaviour (`scripts/evals/bot-*`).

### 1.3 The four implicit structures

**A. The prompt is a list of sections, written as one function.**
`composeBotSystemPrompt` (`bots-chat/domain/bot-prompt.policy.ts`, 664
lines) pushes up to sixteen parts onto an array under ten conditions.

- Seven of its branches test for a tool by its name
  (`'remember'`, `'start_session'`, `'run_command'`, the three terminal
  tools, `'list_projects'`, `'use_skill'`, `'save_skill'`), and the file
  names 25 tools in all; the domain policies together name 37. A tool
  renamed in its factory breaks the prompt with no compile error.
- The sections that explain an area (working on code through sessions,
  commands on a host, driving a terminal) live in the prompt file, not
  with the tools they explain. `AREA_INTROS` lists ten areas by the tools
  that act in each: a second catalog beside the tool factories.
- Two booleans select one of four near-identical paragraphs
  (`REACHABLE`); a third would make eight.
- The file found the right shape three times, locally: `TERMINAL_LINES`
  is a list of `{ when, text }`, `EVENT_PROMPTS` a record with one entry
  per event kind the compiler asks for, `AREA_INTROS` data. None of them
  is the shape of the whole.
- Text the model reads is written in 100 files of the module: the system
  prompt, twelve event prompts, the turn context, 128
  descriptions with their fields', the result mappers, the approval and
  refusal lines. Nothing says how many tokens any of it is.

**B. A tool call passes through six wrappers, composed by object spread
across three files in two packages.** From the model inward:

| # | Wrapper | Where | What it does |
| --- | --- | --- | --- |
| 1 | `runTool` | `agents/src/turn.ts` | loop guard, catches a throw, redacts the key, mends a cut character |
| 2 | `deliverSteers` | `agents/src/turn.ts` | appends what the person sent meanwhile |
| 3 | `nudging` | `bot-toolbox.factory.ts` | counts calls, appends the skill reminder |
| 4 | `bind` → `refusalFor` | `bot-toolbox.factory.ts` | the owner's roles, read at the call |
| 5 | `decidedFirst` | `bot-tool.factory.ts` | escalation, grants, the rules' review, the card |
| 6 | `tool.run` → `call` | `bot-tool.factory.ts` | parses the input, runs, cuts the answer, maps a failure |

The order is correct and each step is commented. But the order is nowhere
written as an order; a new step is a new `{ ...tool, run }` in whichever
file its author is in. The asking path parses the input twice (5, then 6).
Whether a call raised a card is told from 5 to 3 through a module-level
`WeakSet` of result objects (`CARDED`).

**C. A tool's result is several channels in one string and one string
map.** The port's result is `{ content: string; isError?; data?:
Record<string, string> }`.

- What the chat draws from a call (the session it started, a delegate's
  children, shown images, a mail draft, a rate limit) is serialised with
  `JSON.stringify` under five magic keys (`*_DATA_KEY`, and a bare
  `sessionId`) and parsed back in `TurnTranscript`; the loop guard in the
  engines' package adds a sixth. A new kind is an edit in five places: the answer type,
  the result type, `call`, `toEngineResult`, the transcript.
- What the harness adds for the model to read after a result is appended
  to `content` and then cut off again by matching the suffix: the steer
  note (`steerNote` / `withoutSteerNote`), the skill reminder
  (`carrySkillNudge` / `withoutSkillNudge`), the loop guard's note. Three
  features, one trick, because the type has one channel.

**D. One module is the runtime, the features and everyone's tools.**

- `bots-chat` imports twenty other modules of the API. Ten are the
  product areas its tools act in (sessions 55 imports, mail 30,
  automations 21, projects 19, github 14, pull requests 13, tasks 12,
  WhatsApp 10, Telegram 10, hosts 7). `BotToolboxFactory`'s constructor takes
  thirty factories. The module that knows how a turn runs also knows how
  to trash mail.
- Goals, loops, memory dreams, routines, session watches, pull request
  watches, plan watches and channel replies are each a feature built on
  turns, with their own tables and commands, all in the one module.
- `BotTurnContextResolver` takes twenty dependencies and, in one method,
  reads the bot, its credential, documents, memory, skills, history,
  hosts and permissions, builds two toolsets, composes the prompt and
  shapes the request.
- Three places drive the engine, each folding the same events its own
  way: the turn (`TurnTranscript`), a delegate's child (a `Tally` in
  `bot-subagent-runner.factory.ts`) and a completion
  (`BotEngine.completeWithUsage`).

### 1.4 Smaller things the same read found

- `agents/src/turn.ts` (466 lines) holds seven things: redaction, failure
  classification, `Retry-After` parsing, `runTool`, `ToolCallData`,
  steering and `guardTurn`.
- `BotTurnRequest` is one flat record of twenty fields: which model, its
  credential (`apiKey`, and `accountId` for one provider), the content,
  the limits and what one engine needs (`scratchDir`, `cacheKey`). The
  prompt crosses the port as one opaque string, so no adapter can know
  where its stable part ends.
- What an engine does on its own reaches the prompt as English sentences
  from the engines' package (`engineCapabilities`).
- There are two model stacks: `backend-llm` (`complete`, over `fetch`) for
  naming a session and polishing dictation, `backend-agents` for bots,
  joined by `engineLlm`.
- A use case can have four driving adapters, each with its own name,
  schema and description: the HTTP controller, `opp`, an MCP tool
  (`apps/mcp`, 24 tools) and a bot tool (128). The bot tool's `scope` is
  already "the route the tool stands in for".
- The prompt's spec makes 95 `toContain` assertions and takes no
  snapshot: a change to the prompt is a diff inside one 664-line file, and
  nothing reports which section changed or what it costs in tokens.
- `apps/api/.dependency-cruiser.cjs` has no rule that names `bots-chat`:
  nothing holds the runtime apart from the areas it calls.

## 2. What the SDKs are

Read on 2026-11-17 from each project's own documentation, registry entry
and source; the address follows each claim. Three separate reads, by
agents this session started, each asked to mark what it could not confirm
from a primary source; those marks are kept ("not confirmed").

### 2.1 Vercel: the AI SDK, the Workflow SDK and eve

The owner remembered a Vercel SDK that splits things into "directives".
Two of Vercel's products fit, and neither splits a prompt by that name:

- **The Workflow SDK** (`workflow@5.5.0`; "Workflow DevKit" until this
  year) has the two directives, `"use workflow"` and `"use step"`. A
  workflow function is a deterministic orchestrator replayed from an event
  log; a step function does the side effects, and its result is stored and
  retried. They split orchestration from effects, not a prompt
  (workflow-sdk.dev/docs/how-it-works/understanding-directives).
- **eve** (`eve@1.0.1`, 2026-11-16) is the one that splits an agent into
  pieces, as files: `agent/instructions.md`, `instructions/*.ts`,
  `skills/`, `tools/` (the file's name is the tool's), `subagents/`,
  `connections/`, `channels/`, `schedules/`
  (eve.dev/docs/concepts/project-structure). It never calls them
  directives.

**The AI SDK is on version 7** (`ai@7.0.173`; 7.0.0 on 2026-06-25): ESM
only, Node 22, three surfaces (Core, UI, Harnesses) over a provider
specification, `LanguageModelV4` (vercel.com/blog/ai-sdk-7). What it has
that bears on §1.3:

| Piece | What it is | Bears on |
| --- | --- | --- |
| `tool({ inputSchema, execute, toModelOutput })` | a plain value; `execute` answers the result the application keeps, `toModelOutput` what the model reads | C: two channels, declared |
| `contextSchema` and `toolsContext` (v7) | each tool declares the context it needs and sees no more | B: what a call runs with |
| `toolApproval` (v7; replaces `needsApproval` on the tool) | a policy outside the tool that answers `approved`, `denied` or `user-approval`; the call does not block, it answers a request part and is called again with the response | B: the decision as its own step |
| `prepareCall` and `prepareStep` | one runs once per request from typed call options, the other before every model call and can change the instructions, the messages and the active tools | A, and a run as data |
| `activeTools`, `toolOrder`, `deferLoading` with `toolSearch()` | a filter that keeps the types, a pinned order so the cached prefix holds, definitions kept out of context until searched for | the 128 tools |
| `wrapLanguageModel` middleware | a decorator around a model: `transformParams`, `wrapGenerate`, `wrapStream` | B, at the model's side |
| `StopCondition` | the loop's exit as predicates that compose | a run as data |

(ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling, /tool-search,
/middleware; ai-sdk.dev/docs/agents/loop-control,
/configuring-call-options.)

eve's instructions are the closest thing read to §4's sections. Each
piece declares a **role and a lifetime**: a system-role instruction is
outside the history and sent on every call; a user-role one is appended
once and again only when its content changes or compaction removed it; a
skill shows its description until it is loaded; a dynamic one is resolved
before each call with `ctx.memo(key, fn)` saying how long the answer
holds (eve.dev/docs/instructions, eve.dev/docs/concepts/context-control).

What its own documentation says it does not do: compaction in Core is the
application's (`prepareStep` and `pruneMessages`); a subagent is a
pattern, a tool that calls an agent, and approvals do not work inside
one; durability is a second agent class (`WorkflowAgent`) with a
different API; storing `UIMessage` and converting back has lost detail
that a provider then refused (two entries in the 7.0 changelog); caching,
context editing and provider tools do not carry across providers. Version
6 to 7 took six months, with 173 patch releases since.

### 2.2 The two SDKs the engines run on

`@anthropic-ai/claude-agent-sdk` 0.3.326 and `@openai/agents` 0.22.0 (we
pin `^0.3.300` and `^0.21.0`). The same ideas under two sets of names:

| Idea | Claude Agent SDK | OpenAI Agents SDK |
| --- | --- | --- |
| The prompt | `systemPrompt`: a string, a preset with `append`, or `[static, SYSTEM_PROMPT_DYNAMIC_BOUNDARY, perRequest]`, two blocks each with a cache breakpoint | `instructions`: a string or a function of the run's context |
| What changes mid-conversation | never the prompt (it is recorded at the session's start); a note in the conversation: a system reminder, a hook's `additionalContext` | `callModelInputFilter`, before every model call |
| A tool | `tool()` in `createSdkMcpServer` | `tool({ … })` |
| A group of tools | an MCP server (`mcp__server__tool`) | `toolNamespace()` |
| What a tool is like | `annotations` (`readOnlyHint`, `destructiveHint`, …): hints, and `readOnlyHint` is what lets calls run in parallel | none found |
| Offered or not | `tools`, `disallowedTools` | `isEnabled`: "does not replace authorization" |
| Loaded late | tool search, on by default for SDK tools; `alwaysLoad` keeps one up front | `deferLoading` with `toolSearchTool()` |
| Asking first | hooks, then deny rules, ask rules, the mode, allow rules, `canUseTool`; a hook may `defer`, ending the turn so the call resumes later | `needsApproval`, then `interruptions`, then a serialised `RunState` |
| A gate around a call | `PreToolUse` and `PostToolUse` hooks, among 33 events; deny beats defer beats ask beats allow | tool input and output guardrails |
| A child | `agents` and the `Agent` tool: a fresh context, its last message back | `agent.asTool()`; `handoff()` transfers the conversation instead |
| Folding | automatic, with a `compact_boundary` event | a session decorator, or the input filter |

(code.claude.com/docs/en/agent-sdk/modifying-system-prompts,
/custom-tools, /permissions, /hooks, /tool-search;
openai.github.io/openai-agents-js/guides/agents, /tools, /guardrails,
/human-in-the-loop, /running-agents.)

**What our adapters already do with them** (read in
`packages/backend/agents/src`): the Claude engine is closed down as that
SDK's own documentation says a server should be (`settingSources: []`,
`strictMcpConfig: true`, `permissionMode: 'dontAsk'`, an explicit
`allowedTools`), and the OpenAI engine folds through
`callModelInputFilter`. Three things the read turned up that they do not
use:

- Every one of our tools is sent to Claude with `alwaysLoad: true`
  (`claude-tool-server.ts`), so all 128 definitions are in context on
  every turn and the SDK's tool search is off for them.
- A tool's `readOnly` trait does not reach either SDK. On the Claude
  engine that means our read-only tools run one at a time; with
  `readOnlyHint` the SDK may run them side by side (its documentation;
  not measured here).
- The prompt crosses to Claude as one string, though the SDK takes a
  stable part and a per-request part with a boundary between them.

**What neither gives an application**, by their own documentation:
tenancy (the Claude SDK reads the host's settings unless told not to),
durable sessions and approvals (a `sessionStore` or a `Session` to
implement; "only deserialize snapshots from trusted storage"),
authorization, the approval's interface, rollback of a rejected call's
effects, and any way to see or shape the assembled prompt beyond one
string or one function.

**How the two vendors build their own agents' prompts**, from what they
publish: Claude Code's preset is a static body and dynamic sections with
a cache boundary the model never sees; what changes (the project's
instructions, the skill list, a file that changed) travels in the
conversation as reminders; a tool carries its own guidance in its
description (the commit instructions are part of the shell tool's)
(code.claude.com/docs/en/agent-sdk/modifying-system-prompts). Codex keeps
a base prompt per model as a Markdown file and templates beside them, and
its tools are a tree of modules: a registry, a router, an orchestrator,
approvals, sandboxing, handlers (github.com/openai/codex,
`codex-rs/core`).

### 2.3 Prompts as components, other frameworks, other harnesses

**Libraries that make a prompt out of parts.**

| Library | The idea | Standing on 2026-11-17 |
| --- | --- | --- |
| Priompt (Cursor's) | JSX; each part has a priority and the renderer drops the lowest until the prompt fits a token budget | no release since 2024-10; its README: "adding priorities to everything is sort of an anti-pattern", and overuse makes "hard-to-cache prompts" |
| `@vscode/prompt-tsx` | the same in VS Code: `PromptElement`, `priority`, `flexGrow`, `TokenLimit`; what the open-sourced Copilot Chat agent is written in | alive, alpha after two and a half years |
| BAML | a prompt is a typed function in its own language; the answer is parsed against the return type | alive; its own documentation now calls that language the legacy one |
| DSPy | the prompt is generated from a typed signature and tuned by an optimizer | alive, Python; the opposite of owning the text |
| POML, ell | markup; a decorated function | stalled |

(github.com/anysphere/priompt, github.com/microsoft/vscode-prompt-tsx,
docs.boundaryml.com.)

Copilot Chat is the one worth reading for structure, apart from its JSX:
budgets sit on the history and the tool calls only, never on
instructions; a registry picks the prompt's classes per model family; and
a message once rendered is stored and replayed frozen, "for prompt
caching and to avoid being updated by any agent action below this point"
(github.com/microsoft/vscode-copilot-chat,
`src/extension/prompts/node/agent/`).

**Frameworks.**

| Framework | Its seam | In our terms |
| --- | --- | --- |
| Pydantic AI (Python; the reference design) | instructions are named functions of the run's context, "always sorted by how much they can change the prompt prefix": static first, then those that append a change to the history, then those that rewrite; toolsets are values that compose (`.filtered()`, `.approval_required()`, `.defer_loading()`) | sections with a stability; an area as a value |
| Mastra | every field of an agent may be a function of the request; a pipeline of processors before and after each model call, which is also how its memory is built | middleware, at the model's side |
| LangChain v1 over LangGraph | `createAgent` with middleware (`wrapModelCall`, `wrapToolCall`) around what is still a model node and a tool node; a graph, checkpoints and `interrupt()` underneath | middleware; the graph is more than a loop needs |
| Effect AI | a tool is a declaration with no handler; handlers are supplied as a layer, and a missing one does not compile | a port and its adapter, enforced by types, at the price of the Effect runtime |
| Cloudflare Agents | the harness (the loop) apart from the hosting (a Durable Object per agent) | where a turn runs, apart from how |

(pydantic.dev/docs/ai, mastra.ai/docs/agents/processors,
docs.langchain.com/oss/javascript/langchain/middleware,
effect.website/docs/ai, developers.cloudflare.com/agents.)

**Harnesses whose source can be read.** These are the closest to what we
have, and all of them moved the same way.

- **pi** (`earendil-works/pi`, 1.5). It began as one prompt string and
  four tools; its system prompt is now an ordered record of named
  sections, each in a tag of its own name. A tool brings its own text
  (`promptSnippet`, `promptGuidelines`), shown only while the tool is
  active. When a section changes, pi "diffs the resulting prompt sections
  against what the model already has and appends one system message
  patching only the changed sections"; replacing the prompt is "a cache
  miss".
- **OpenCode** (`anomalyco/opencode`, rewritten on Effect). One small base
  prompt with a slot each active tool fills. Everything that changes is
  an instruction source with a key, a `read` and two renderings,
  `initial` and `changed(previous, now)`, so a change is told as a new
  message and the first one keeps its bytes. Of tools: "tool filtering is
  catalog visibility, not execution authorization"; permission is
  asserted where the tool acts.
- **Cline**. Until its rewrite the prompt was `components/` (a file per
  section), `variants/<model family>/` and `tools/<tool>.ts`, composed by
  a registry and snapshot-tested per variant. Its SDK now splits a
  stateless loop (`agents`) from sessions, storage and compaction
  (`core`), and keeps the transcript append-only with compaction beside
  it.
- **OpenHands**. An append-only event log; what the model is sent is a
  view derived from it; compaction is a strategy (`CondenserBase`) that
  writes an event of its own.
- **Goose**. The whole prompt is one template that loops over the
  extensions, each bringing its own instructions.
- **Roo Code**. One function per section, joined by a builder that takes
  sixteen positional parameters: the split without the common shape.

(github.com/earendil-works/pi, `packages/coding-agent/src/core/system-prompt.ts`
and `docs/extensions.md`; github.com/anomalyco/opencode,
`packages/core/src/instructions` and `tool/AGENTS.md`;
github.com/cline/cline, `sdk/ARCHITECTURE.md` and the v3.50.0 tag;
docs.openhands.dev/sdk/arch. Roo Code's closure is from secondary sources
only: not confirmed.)

**What is written about the question itself**, as rules for code:

- Keep the prefix stable, the context append-only, the serialisation
  deterministic, and mark where the cache may break; do not add or remove
  tools mid-conversation, mask them (Manus, 2025-07,
  manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus).
- Organise a prompt into distinct sections; return only what is worth its
  tokens from a tool; a tool's description is something to version and
  evaluate (Anthropic, "Effective context engineering for AI agents" and
  "Writing tools for agents", 2025-09).
- Own your prompts and your control flow; a tool is structured output
  that triggers code you wrote; the loop is a reducer with its state kept
  outside (12-factor agents, factors 2, 4, 8 and 12,
  github.com/humanlayer/12-factor-agents).
- "Every component in a harness encodes an assumption about what the
  model can't do on its own": build each so it can be taken out
  (Anthropic, "Harness design for long-running apps", 2026-03).

## 3. What the reads add up to

Inferred from §1 and §2. Fourteen patterns recur across what was read;
this is where each stands here.

| Pattern | Who has it | Here |
| --- | --- | --- |
| Named, ordered sections | pi, Cline, Pydantic AI, Copilot Chat, eve | **implicit** (§1.3 A) |
| A tool brings its own guidance | pi, OpenCode, Goose, Claude Code | **missing**: the playbooks are in the prompt's file |
| Stable first, and a change appended rather than rewritten | Pydantic AI, pi, OpenCode, Copilot Chat, the Claude SDK's boundary, Manus | **half**: the order is right and the moment is in the message, but a profile fact the bot remembers rewrites the prompt for the next turn |
| A tool as one declared object with traits | all of them | have (`defineBotTool`) |
| Offered apart from authorized | OpenCode, both vendor SDKs | have (the catalog's filter; the owner's roles read at the call) |
| Approval as a policy outside the tool, resumable | AI SDK 7, OpenAI's `RunState`, Claude's `defer` | have, stored as a card; lives in wrapper 5 |
| Middleware around a call | Mastra, LangChain v1, Claude's hooks, OpenAI's guardrails | **implicit** (§1.3 B) |
| What the application keeps apart from what the model reads | AI SDK's `toModelOutput`; Claude's reminders | **missing** (§1.3 C) |
| A stateless loop, its events folded outside | OpenHands, Cline, 12-factor | have (the port's stream, `TurnTranscript`) |
| Compaction as a step that records an event | OpenHands, OpenCode, pi | have (`compacted`) |
| A run described as data | AI SDK's `prepareCall`, OpenAI's `RunConfig`, Claude's `AgentDefinition` | **half**: one flat request; a completion told by its shape |
| Areas as values that contribute | Pydantic AI's toolsets, eve's files, Goose's extensions | **half**: `BotToolArea` exists; thirty are wired by hand in one module |
| A prompt variant per model family | Copilot Chat, Cline, Codex | barely (`engineCapabilities`); nothing has needed more |
| A budget and priority per part | Priompt, prompt-tsx | not needed: history and memory are budgeted where they are read |

Five are here whole and two have not been needed, which is why §0 says
the core is sound. The seven in bold are §1.3's four structures and
§1.4's flat request, seen from outside.

**Why none of them should be the runtime.** Each framework's centre is
the loop and the provider, which we have behind a port and which is not
where our trouble is; what is tangled here (the prompt, the catalog, the
permission layer, the modules) every one of them leaves to the
application, by its own documentation. Adopting one would also cost what
`design/bots/bots.md` §2 chose the vendors' SDKs for (Claude Code's
loop and folding; a ChatGPT sign-in through the Codex backend), and the
AI SDK in particular is ESM-only on Node 22 where the API compiles to
CommonJS, with a major version every six months. The projects whose
centre was a language or a runtime of their own for prompts are the ones
that stalled or relabelled it (Priompt, POML, ell, BAML's first
language). The ideas that lasted are plain: a list of named sections, a
tool that carries its text, a pipeline, an event log.

## 4. The proposal: name the four structures

One sentence of Torvalds's is the whole design: bad programmers worry about
the code, good ones about data structures and their relationships. Each
tangle in §1.3 is a data structure that exists and was never declared. The
proposal declares them, in a kernel that knows no framework, no SDK and no
product area, and moves the existing code onto them. It adds no graph, no
template language and no dependency.

```
            driving adapters                     driven adapters
   HTTP · opp · MCP · bot tool  ─┐          ┌─  Claude Agent SDK
   (one use case, four doors)    │          │   OpenAI Agents SDK
                                 ▼          ▼   (a third is a class)
   product areas ──contribute──▶ bot runtime ──▶ BotEngine port
   sessions, mail, …             plan a run, run it, fold its events
   tools · sections · intro            │
                                       ▼
                               agent kernel (pure)
                 PromptSection · ToolMiddleware · ToolResult · RunPlan
```

In clean-architecture terms: **a bot tool is a controller whose client is
a model**, so it belongs with the use case it stands in for, beside that
use case's HTTP controller; **text written for a model is a view**, so it
has an owner, a size and a test, as the console's copy has; and **the
model's SDK is a driven adapter**, which it already is.

### 4.1 The kernel

A new package with no dependencies, the way `backend-ddd` has none:
`packages/backend/agent-kernel`. Types and pure functions, a few hundred
lines. `backend-agents` (the engines) and the API both build on it; a
module's `domain/` may import it, as it may `backend-ddd`.

**Sections.** A prompt is an ordered list of sections, each with an owner,
a condition and a stability.

```ts
export interface PromptSection<Context> {
  /** `conduct`, `sessions.playbook`: what a manifest, a snapshot and an eval name. */
  id: string;
  /** Where it goes. The order of the slots is one array, in one file. */
  slot: 'identity' | 'conduct' | 'capabilities' | 'rules' | 'playbook' | 'documents' | 'skills' | 'memory';
  /** `static`: the same for every bot offered the same tools. `bot`: changes when the bot does. */
  stability: 'static' | 'bot';
  when?(context: Context): boolean;
  render(context: Context): string;
}

export function composePrompt<Context>(
  sections: readonly PromptSection<Context>[],
  context: Context,
): PromptPlan; // { segments: { id, slot, stability, text, tokens }[], text }
```

- The slot order puts every `static` section before every `bot` one, so
  the stable prefix is as long as it can be, and the plan says where it
  ends. The facts of the moment stay out of the system prompt, in the
  turn's message, as today; the turn context becomes the same kind of
  list (`{ id, when, render }` over the time, the hosts, the room left,
  the log).
- A section asks for a **capability**, never a tool's name. A tool
  declares what it provides (`provides: ['sessions.start']`), a section
  asks `context.can('sessions.start')`, and the capability is a union
  type: renaming a tool changes nothing, and a misspelt capability does
  not compile.
- An area contributes its own sections. "Working on code through
  sessions" is the sessions area's, "Driving a terminal" the terminal
  area's, an `AREA_INTROS` row its area's `intro`. Adding an area adds its
  tools, its playbook and its line of the greeting in one place; turning
  it off removes all three.
- `PromptPlan` is a manifest for free: each section's tokens, so a pull
  request can show "`sessions.playbook` +180 tokens", a spec can snapshot
  one section, an eval's regression can be traced to the section that
  changed, and a section can be left out of an eval's run to see whether
  it still earns its tokens. Many of the prompt's paragraphs were added
  after an incident, and nothing today can test whether one is still
  needed.

**A tool's result has its channels.**

```ts
export interface ToolResult {
  /** The tool's own words: what the model reads first and the chat shows. */
  content: string;
  isError: boolean;
  /** What happened to the call. Replaces the `CARDED` set. */
  outcome: 'ran' | 'refused' | 'asked';
  /** What the harness adds for the model alone: a steer, a reminder, a loop warning. */
  notes: readonly { kind: string; text: string }[];
  /** What the call made, for the chat: a session, a draft, images. Typed where it is declared. */
  artifacts: readonly { kind: string; value: unknown }[];
}
```

An engine joins `content` and `notes` when it hands the result to its SDK,
and `tool.finished` carries the three apart, so nothing is appended and
cut off again. The artifact kinds are one union in `packages/shared`,
where their types already are; a new kind is a member of the union and a
case where the chat draws it, and the engines' package never learns it.

**A call is a pipeline.**

```ts
export type ToolMiddleware<Context> = (
  call: ToolCall,           // { tool, input, callId?, signal }
  context: Context,
  next: (call: ToolCall) => Promise<ToolResult>,
) => Promise<ToolResult>;
```

The six wrappers of §1.3 B become one array, in one file, in the order
they run. That file is then the answer to "what happens when the model
calls a tool":

```ts
export const TOOL_PIPELINE = [
  loopGuard,       // a call going round in circles is refused
  ownerRoles,      // the owner's roles, read now
  parseInput,      // once; a bad call is an error the model can correct
  decide,          // escalation, grants, the rules' review, or a card
  run,
  fitOutput,
  skillReminder,
  steer,
  redact,          // last out: nothing leaves with the key in it
] as const;
```

Each is a function with a spec of its own. The engines' package keeps its
three (`loopGuard`, `steer`, `redact`) and still applies them whatever a
caller composes, as `guardTurn` holds the stream today.

**A run is described before it is run.**

```ts
export interface RunPlan {
  kind: 'turn' | 'child' | 'completion';
  model: ModelRef;        // provider, model, effort, and a credential that is a union by provider
  prompt: PromptPlan;
  history: readonly HistoryEntry[];
  input: { text: string; images: readonly TurnImage[] };
  tools: readonly EngineTool[];
  limits: { maxSteps?: number; timeMs?: number };
  compaction: false | { window: number | null };
}
```

`BotTurnRequest`'s twenty flat fields become these groups plus what only
the runner knows (the signal, the scratch directory, the steering). The
kind is stated, where today a completion is recognised by its shape
(`isCompletionRequest`). One `foldUsage` reads what a run spent, for the
turn, the child and the completion alike.

### 4.2 The runtime, and who contributes to it

- **`bots-chat` becomes the runtime and nothing else**: claim a turn, plan
  it, run it, fold it into the transcript, stream it, and the permission
  layer (grants, rules, cards). It imports no product area, and a
  dependency-cruiser rule says so, as `auth-is-a-kernel` does for `auth`.
- **Each area's tools move to the module that owns the use cases**, in a
  `bot-tools/` directory beside its slices, and reach the runtime through
  `BotsChatModule.contributeTools([...])`, the shape
  `AuthModule.contributeCredentials` already has. `BotToolboxFactory`'s
  thirty constructor arguments become one injected list.
- **`BotTurnContextResolver` becomes a planner over contributors**: each
  thing a turn reads (the bot's documents, memory, skills, hosts,
  history) is a small reader that answers a part of the plan, and the
  planner composes them.
- **The features built on turns** (goals, loops, dreams, routines, the
  three kinds of watch, channel replies) each need four things of the
  runtime: queue a turn with an origin, contribute tools, contribute a
  section, contribute their event's prompt. With those four as published
  ports, each can leave for a module of its own when it is next touched.

### 4.3 What this deliberately is not

- **Not a framework adoption.** §3 says why none fits as the runtime. A
  third engine (the AI SDK over a provider's API, or a loop of our own)
  stays possible as one class behind the port, and is a separate
  decision.
- **Not JSX, not a template language.** Sections are functions that
  return strings, as `TERMINAL_LINES` already is. A priority and a budget
  per section (what Priompt and prompt-tsx are for) is added only when a
  section has to shrink to fit, which none does today: the history and
  memory are budgeted where they are read, and Priompt's own README warns
  that priorities on everything make a prompt hard to cache.
- **Not a graph.** A turn is a loop the vendors' SDKs already run; what
  surrounds it is a pipeline and a fold.
- **Not a rewrite of the prose.** Slices 1 to 5 move text without
  changing a byte of it, and a spec holds that.
- **Not one catalog for HTTP, `opp`, MCP and bots yet.** §1.4's four
  doors want one description of a use case; moving a bot tool beside its
  controller is the step that makes that possible, and no more is
  proposed here.

## 5. Order of work

Each slice is one pull request under `/propose`, safe to stop after. The
net under all of them is what exists: 28,800 lines of specs in `bots-chat`,
the engines' specs, and the eight evals in `scripts/evals/bot-*`, run
before and after each slice that touches text the model reads.

| # | Slice | Changes behaviour? | What it proves |
| --- | --- | --- | --- |
| 0 | **Pin what must not move.** A spec that snapshots the system prompt for six reference bots (no tools; sessions; sessions and commands; terminals; everything; a new bot), byte for byte; one that snapshots the tool catalog (name, description, schema); and one that composes the same bot's prompt for two turns and asserts the same bytes | no | every later slice is checked against bytes, not substrings |
| 1 | **The kernel's types, and the prompt on sections.** `agent-kernel` with `PromptSection` and `composePrompt`; `bot-prompt.policy.ts` becomes a list of sections; capabilities replace tool names; a prompt manifest (`pnpm bots:prompt`) prints each section's tokens | no (slice 0's snapshots are unchanged) | the section shape holds the prompt we have |
| 2 | **Results with channels.** `ToolResult` with `notes` and `artifacts` through the port and both engines; the five data keys, the three append-and-strip pairs and `CARDED` go | no | a new artifact is one union member |
| 3 | **The pipeline.** The six wrappers become `TOOL_PIPELINE`; the input is parsed once; `turn.ts` splits into its seven files | no | the order is written down and each step tested alone |
| 4 | **`RunPlan`.** The port takes the plan; the turn, the child and the completion share one fold of usage; the credential is a union | no | one description of a run |
| 5 | **Tools go home.** `contributeTools`; the areas move to their modules one pull request each, sessions first; sections and intros move with them; the boundary rule lands when the last one has | no | `bots-chat` imports no product area |
| 6 | **What the structure makes cheap**, each its own proposal, measured first (below) | yes | only what the owner asks for |

Slices 1 to 3 do not depend on each other and can run side by side.
Slice 5 is the long one (thirty areas) and the only one whose value
arrives a piece at a time.

Slice 6's candidates, from §2. Each is a guess until it is measured, and
every turn already stores what it read from the provider's cache
(`cacheReadTokens`), so each can be:

- **A changed section is told, not rewritten.** A profile fact the bot
  remembers changes the system prompt, so the next turn's whole history is
  read uncached. pi, OpenCode and Pydantic AI append the change to the
  conversation and leave the first bytes alone.
- **The same tools from turn to turn.** A wake's turn and a person's turn
  in one conversation are offered different tools (`notOn`,
  `attendedOnly`), and the tool definitions come before the prompt in
  what Anthropic's API caches. Manus's rule is to mask a tool, not remove it;
  here that is offering it and refusing its call, which the pipeline's
  `ownerRoles` step already does for a role.
- **Fewer definitions up front.** All 128 are sent on every turn. Both
  vendors' SDKs can hold an area's definitions back until they are
  searched for; the areas of slice 5 are the unit to hold back.
- **Read-only calls side by side**, by passing the trait to the Claude
  SDK as `readOnlyHint`.
- **Cache breakpoints at the plan's stable boundary**, for an engine that
  takes them.
- **The features of §4.2 in modules of their own**, and **one description
  of a use case for its four doors**.

### What would make this the wrong plan

- If the owner means to replace both vendor SDKs with a loop of our own,
  slice 4 is designed with that loop and should wait for the decision.
- If the bot's tools are to become MCP tools served to the engines (one
  catalog with `apps/mcp`), slice 5's destination is different: the
  areas would move to that server, not to the modules.
- If `bots-chat` is to leave the API process for a worker of its own
  (`design/bots/bots.md` §8 keeps that open), contribution through
  Nest's injector (slice 5) binds the runtime to the API's modules more
  tightly than calling them over HTTP would.
