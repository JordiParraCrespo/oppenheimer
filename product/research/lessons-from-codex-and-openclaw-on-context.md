# Lessons from Codex and OpenClaw on context: skills, instructions, tools (2026-11-23)

The question: before the bots' prompts are cut into per-capability modules
(mail, whatsapp, sessions, terminal, browser…), with long guidance moved
out of the always-on system prompt into built-in skills and perhaps tool
definitions deferred, how do Codex and OpenClaw keep what they send small
and still working, and what does Anthropic's side (Agent Skills, tool
search) ask of a caller?

This note builds on three earlier ones and does not repeat them:
[`lessons-from-openclaw-and-grok-bot-skills.md`](lessons-from-openclaw-and-grok-bot-skills.md)
(OpenClaw's skill format and slash commands, read from its docs),
[`lessons-from-codex-and-grok-chat.md`](lessons-from-codex-and-grok-chat.md)
(Codex's protocol and UI) and [`prompt-file-formats.md`](prompt-file-formats.md)
(how prompt files are laid out, and our 23.9 KB). It also picks up a
finding of [`agent-stack-architecture.md`](agent-stack-architecture.md):
every bot tool goes to Claude with `alwaysLoad: true`.

Sources, read in code this time:

- **Codex**: `github.com/openai/codex`, shallow clone of `main` at
  `d4af2452f7b5` (2026-11-23). Paths are relative to `codex-rs/`.
- **OpenClaw**: `github.com/openclaw/openclaw`, shallow clone of `main` at
  `57dd84bd1e0f` (2026-11-24). Paths are relative to the repository; the
  docs are its `docs/` folder, published at `docs.openclaw.ai`.
- **Anthropic**: `agentskills.io/specification`;
  `platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool`;
  `…/tool-use/tool-use-with-prompt-caching`; `code.claude.com/docs/en/mcp`
  ("Scale with MCP tool search").

Nothing was run from either clone.

## 1. Codex

**Skills are a developer message, not the system prompt.** The catalog
is a `<skills_instructions>` fragment with role `developer`
(`ext/skills/src/fragments.rs`); a skill's body, once used, goes in as a
separate `user` fragment. The base instructions
(`protocol/src/prompts/base_instructions/default.md`, 20.9 KB, about
5,000 tokens) never contain a skill.

**The list has a budget, and degrades in three steps**
(`ext/skills/src/render.rs`):

- The budget is 2% of the model's context window in tokens (counted as
  bytes / 4), or 8,000 characters when the window is unknown; a configured
  budget is capped at 10,000 tokens.
- A description is cut at 1,024 characters. A name is at most 64
  (`skills/src/parser.rs`).
- If everything fits, it is sent whole. If not, descriptions are shortened
  to share what is left after the names and paths; if even the names do not
  fit, skills are omitted from the end. Each step leaves a warning for the
  person ("Exceeded skills context budget…"), not for the model.

**The list changes by appending, never by rewriting.** `catalog_delta.rs`
says it in its header: "Publishes skill changes within one metadata budget
per context window. Each snapshot remembers the full inventory and which
skills the model has seen. Compaction starts a fresh listing and budget."
A new or changed skill is sent later as "### Added or updated skills"; one
that went away is a short "verify current access" note. The earlier
listing stays where it was.

**How a skill is used is told once, in about 2.5 KB**
(`ext/skills/src/catalog_prompt.rs`): use a skill when the person names it
(`$name`) or "the task clearly matches a skill's description"; read the
whole `SKILL.md` before acting; open only the references it routes to;
"Do not carry skills across turns unless re-mentioned"; pick the minimal
set and say in one line which and why. A skill can opt out of implicit use
(`policy.allow_implicit_invocation` in `agents/openai.yaml`,
`skills/src/metadata.rs`). A plugin's skill body is cut at 8,000 bytes
with a warning (`MAX_SKILL_PROMPT_BYTES`, `host_prompt.rs`).

**AGENTS.md** (`core/src/agents_md.rs`): every `AGENTS.md` from the
project root (the nearest `.git`) down to the working directory,
concatenated, `AGENTS.override.md` preferred, under one budget of 32 KiB
(`project_doc_max_bytes`). Past it, a file is truncated and the rest
skipped, each with a warning telling the person to trim. It goes in as a
`user`-role fragment.

**Tools: MCP and dynamic tools are deferred behind `tool_search`.** The
feature flags record it as settled: "tool_search is always enabled", "MCP
tools are always deferred when tool_search is available"
(`features/src/lib.rs`). `tool_search` is a client-executed tool
(`execution: "client"`) whose description lists the enabled sources by
name and description, capped at 512 KiB
(`core/src/tools/handlers/tool_search_spec.rs`). It ranks with BM25 over
names, descriptions and parameters and returns 8 by default
(`tools/src/tool_discovery.rs`). What it finds comes back as a
`tool_search_output` item in the conversation, each definition marked
`defer_loading: true` with its output schema dropped
(`tools/src/tool_search.rs`, `protocol/src/models.rs`), so the request's
`tools` array and everything before the search stay as they were.
Command output is capped at 10,000 tokens a call
(`core/src/unified_exec/mod.rs`).

**Caching** is a `prompt_cache_key` per thread
(`codex-api/src/common.rs`); the design above (developer fragments,
appended deltas, found tools as items) is what keeps the prefix stable.

## 2. OpenClaw

**The system prompt has a marked cache boundary.**
`<!-- OPENCLAW_CACHE_BOUNDARY -->` (`packages/ai/src/utils/system-prompt-cache-boundary.ts`)
splits it. Above: identity, fixed policy, the workspace's bootstrap files
("Project Context") and the tool capability directory. Below: the current
tool and skill catalogs, memory, channel, sandbox and per-turn guidance
(`docs/concepts/system-prompt.md`). The Anthropic transport puts
`cache_control` on the stable part, within the four-breakpoint limit
(`packages/ai/src/transports/anthropic-payload-policy.ts`). Date, time zone
and live facts are not in the system prompt at all: they ride a separate
runtime-context message each turn, "so day rollover leaves the complete
system prompt and prior conversation bytes unchanged". On direct Anthropic
and OpenAI Responses routes, a refreshed section is appended as an
instruction message after the current user turn rather than rewriting the
prompt. Committed prompt snapshots, checked in CI
(`pnpm prompt:snapshots:check`), catch drift.

**Skills** (`src/skills/loading/`):

- Listed as `<available_skills>` with name, description and location;
  about 97 characters (24 tokens) a skill before those fields
  (`docs/tools/skills.md`, "Token impact").
- At most 150 skills and 18,000 characters (`skill-prompt-limits.ts`).
  Past that: the compact format (descriptions cut to 220 characters, then
  shortened by binary search, then dropped), then fewer skills, always with
  a visible "⚠️ Skills truncated: included N of M" line. Skills cut from the
  list stay findable with `skills_search` (default 5 results, at most 20).
- When `skills_read` exists, the list loses its paths and becomes one line
  a skill, `- "name": description`, since the tool reads by name
  (`src/agents/system-prompt-skills.ts`). The section ends with "Pick at
  most one (most specific) up front; read none if irrelevant; never invent
  paths."
- `skills_read` returns the whole `SKILL.md` (at most 256 KiB, refused
  rather than cut); a body longer than one tool result is paged, never cut
  from the middle.
- Eligibility is decided once per session (a snapshot) and gated on
  `metadata.openclaw.requires` (`bins`, `anyBins`, `env`, `config`) and
  OS; the section is left out when the agent has no tool that can read a
  skill.

**Bootstrap files**: `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`,
`BOOTSTRAP.md` (new workspaces only) and `MEMORY.md`. 20,000 characters a
file, 60,000 in all (`src/agents/embedded-agent-helpers/bootstrap.ts`),
truncated head 75% / tail 25% with a marker; an over-long `AGENTS.md` keeps
a digest of its rule lines (`must`, `never`, `do not`…). One fixed notice
tells the model some files were cut and to read them. `TOOLS.md` is now
folded into `AGENTS.md`'s `## Tools` section by a doctor migration
(`src/commands/doctor-tools-md-migration.ts`). Sub-agents get `AGENTS.md`
only, under a `minimal` prompt mode that drops memory, messaging and output
sections. `memory/*.md` is never injected; it is read through
`memory_search` / `memory_get`.

**Tools**: tool policy (profile, allow, deny) decides what the model may
see; Tool Search is the default in embedded runs (`docs/tools/tool-search.md`).
The model gets `tool_search`, `tool_describe` and `dispatch_action`, plus a
capability directory: sorted by name, at most 18,000 characters, rebuilt
only when the authorised catalog changes, and placed above the cache
boundary. A separate MCP directory takes 4,096 bytes (about 1,000 tokens),
one line a tool, descriptions cut to 96 characters, and "github server: 40
tools, names omitted" when it runs out. A search hit carries a compact
TypeScript signature (at most 300 characters) so `tool_describe` is often
not needed; output schemas are left out unless asked for. Core primitives
and `direct-only` tools stay loaded. Their `/context` report on an example
run: system prompt 38,412 characters, skills list 2,184 (12 skills), tool
schemas 31,988 (about 8,000 tokens): the schemas are the largest single
part.

**Heartbeat**: retired. Heartbeat monitors are now ordinary automation
jobs, `HEARTBEAT.md` is imported into a job's scratch, and "the system
prompt contains no heartbeat-specific section"; an edge `HEARTBEAT_OK` in
an alert is still stripped on delivery (`docs/gateway/heartbeat.md`).

**Compaction and pruning** (`docs/concepts/compaction.md`,
`session-pruning.md`): compaction starts at the smaller of 85% of the
window and the window minus a 20,000-token reserve, keeps the newest 20,000
tokens, and caps the summariser's input at 160,000 characters. Old tool
results are pruned only after the cache TTL has lapsed (5 minutes, 1 hour
for Anthropic): over 4,000 characters keeps the first and last 1,500, and
at 50% use old results are replaced by a placeholder. Pruning is skipped
below about 30% use, because it costs a cache write.

## 3. Anthropic

**Agent Skills** (`agentskills.io/specification`): a folder with
`SKILL.md`; frontmatter `name` (1–64, lowercase, digits, hyphens, matching
the folder), `description` (1–1,024, what it does and when to use it),
optional `license`, `compatibility` (≤ 500), `metadata`, and experimental
`allowed-tools`. Progressive disclosure in three tiers: metadata about 100
tokens a skill at start; the body, under 5,000 tokens and 500 lines, when
used; `references/`, `scripts/` and `assets/` when needed, one level deep.

**Tool search** (`tool_search_tool_regex_20251119` or `_bm25_20251119`):
the caller still sends every definition on every request, marks the
deferred ones `defer_loading: true`, and keeps at least one tool loaded
(the search tool itself; the docs advise the 3–5 most used). A search
returns 5 by default as `tool_reference` blocks that the API expands in
place. Deferred tools are kept out of the prefix and found ones are
appended in the conversation, so "the prefix is untouched, so prompt
caching is preserved". A deferred tool cannot carry `cache_control`; up to
10,000 deferred tools. A custom search can return `tool_reference` blocks
from your own tool. Changing any tool definition still invalidates the
whole cache (tools → system → messages).

**Claude Code / the Agent SDK** defers MCP tools by default
(`ENABLE_TOOL_SEARCH` unset means deferred; `auto` only past 10% of the
window). A tool loaded up front has its description cut at 4,096
characters, one found by search at 16,384; `_meta["anthropic/alwaysLoad"]`
keeps one up front. Our `claude-tool-server.ts` sets it on every tool, so
all of them load on every turn.

## 4. What Oppenheimer should copy

Ranked by what it saves against what it costs.

1. **Defer the tools of a capability that is not in play, on both
   engines; keep a small core loaded.** Tool schemas, not prose, are the
   bulk (OpenClaw's own report; Anthropic's ~55k-token example). On the
   Claude engine this is removing `alwaysLoad: true` from all but the core
   (`use_skill`, the reply and approval tools, the 3–5 most used), which
   Claude Code then defers with no cache cost (tool-search and
   prompt-caching docs). On the OpenAI engine it is the Agents SDK's
   `deferLoading` with a client-executed tool search, which is what Codex
   does (`tools/src/tool_search.rs`). Keep the tool list itself identical
   on every turn of a bot: adding or removing a definition invalidates
   everything.
2. **One capability directory line per module, in the stable prefix.**
   "Mail: read, send and watch mail; search tools for mail", one line each,
   sorted, rebuilt only when the bot's offered capabilities change
   (OpenClaw's directory and its 96-character MCP lines; Codex's
   source list in the `tool_search` description; Anthropic's "add a system
   prompt section describing available tool categories").
3. **A module is a pair: its tools and its built-in skill, offered
   together.** List the skill only when the bot is offered the tools
   (OpenClaw gates the Skills section on having a reader, and skills on
   `requires`); `composeBotSystemPrompt` already gates prose on offered
   tools, so this moves the same test onto skills. Using the skill is
   the signal to search for (or load) its tools.
4. **Give the skills list a budget with a named fallback, held by a
   test.** A count and a character cap, descriptions cut first, names last,
   and a line saying the list was cut (OpenClaw: 150 skills, 18,000
   characters, 220-character compact descriptions; Codex: 2% of the window
   or 8,000 characters, 1,024 per description). With built-in skills
   added to a bot's own, this is where growth will show first. It extends
   `prompt-file-formats.md` §4.5's ceiling to the list.
5. **Built-in skill bodies follow Agent Skills' size and whole-read rule.**
   Under 5,000 tokens and 500 lines (Agent Skills), read whole, never cut
   from the middle (OpenClaw pages instead; Codex warns when it truncates).
   Long references go one level down and are read on demand.
6. **Nothing that changes inside a conversation goes in the system
   prompt; a change is appended.** A capability granted mid-conversation, a
   skill saved by `save_skill`, today's date: an instruction message after
   the turn, the way Codex's `catalog_delta.rs` publishes "Added or updated
   skills" and OpenClaw appends refreshed sections. A new listing starts
   only after compaction. This is the rule our byte-stable prompt already
   follows, made explicit for the module system.
7. **One "how to use skills" paragraph, written once.** Codex's covers
   trigger, read whole before acting, minimal set, say which and why, and
   "do not carry skills across turns unless re-mentioned"; OpenClaw's ends
   "pick at most one up front; read none if irrelevant". Name-only lines
   (`- "name": description`) when `use_skill` reads by name: paths and
   locations only cost context (`system-prompt-skills.ts`).
8. **Measure it the way `/context` does.** Per turn: system prompt size,
   skills list size and count, tool schema size by module, cache read and
   write tokens. OpenClaw's report shows where the context goes; without it
   the refactor cannot show what it saved.
9. **Smaller prompts for jobs.** OpenClaw's `minimal` mode for
   sub-agents (only `AGENTS.md`, no messaging or memory sections) maps onto
   our `jobs/` prompts: a summary or rule-review job needs no capability
   directory and no skills.

Not to copy: OpenClaw's bootstrap files on disk and their head/tail
truncation (a bot's instructions are rows, and short); pruning old tool
results (it rewrites the history and costs a cache write, and is worth it
only once conversations are long, after the TTL, as OpenClaw does).

## 5. What could not be verified

- Which Claude Code version `@anthropic-ai/claude-agent-sdk@^0.3.300`
  bundles, so whether removing `alwaysLoad` defers our tools exactly as the
  current `code.claude.com` page describes, behind a custom
  `ANTHROPIC_BASE_URL` (GLM) in particular. To be checked in a live turn.
- That OpenAI's Responses API keeps its cache when a client-executed
  `tool_search` adds tools: inferred from where Codex puts them, not from
  an OpenAI document. Codex's hosted docs
  (`developers.openai.com/codex/skills`) were not read.
- OpenClaw's Anthropic payload was read up to where it places
  `cache_control`, not traced end to end; its token numbers are from its
  docs and code defaults, not measured.
- Whether the bots' Agents SDK version exposes `deferLoading` and a tool
  search tool: `agent-stack-architecture.md` says it does; not rechecked.
