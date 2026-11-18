# Prompt files: how others lay them out, and what to take

2026-11-17. A read of how other agent products keep the words they send a
model in files, beside our own `domain/prompts/*.md` (pull request #914,
`versions/mvp/25-bots.md` §8). It follows
[`agent-stack-architecture.md`](agent-stack-architecture.md), which chose
to start the refactor with the prompt's words. This note decides nothing.
Code paths of ours are from the repository root.

**Measured** means read in the product's repository at the commit named,
or in its published specification, on 2026-11-17. **Inferred** is marked.

## 1. The answer

There are three kinds of prompt file in the industry, and only the first
is the kind we are building:

| Kind | Who | Shape |
| --- | --- | --- |
| **An agent's own prompt, as assets** | Codex, Goose, OpenCode, Cline, eve's instructions | plain text or Markdown compiled into the build, a few slots or none, no metadata |
| **Instructions a person writes** | Agent Skills, Claude Code skills, Cursor rules, VS Code prompt files, pi templates, eve's skills and schedules | YAML frontmatter that says *when the file applies*, then a Markdown body |
| **A prompt as a runnable artifact** | dotprompt, Prompty | frontmatter holding the model, its settings and the input and output schemas, then a templated body with role markers |

Ours matches the first kind's best example closely. Codex keeps its
prompts as Markdown, fills them through a strict template with `{{ name }}`
slots, compiles them in, and puts no logic in the files. That is the
design #914 arrived at, so nothing in it needs redoing. eve, Vercel's
framework, goes one step further the same way: its instruction files are
Markdown with no slots and no frontmatter, and anything that varies is
TypeScript (§2.5).

Six things are worth taking, in this order (§4 has each with its
evidence):

1. **Folders that say where the words are sent**, before the flat
   directory grows past the twelve files it has.
2. **One file per alternative** when an alternative is a paragraph, with
   the folder naming the choice; fragments stay for one-line choices.
3. **Tool descriptions as files beside the tools**, held to a budget that
   says "what it does and when to use it".
4. **What a person or a bot wrote goes in a tag it cannot close**, not
   under a heading in the same voice as our own rules. This one changes
   what a bot is sent, so it is a proposal with an eval, not a tidy-up.
5. **A size ceiling per prompt, checked.**
6. **A blank value leaves its section out**, as a rule of the reader
   rather than an `if` at each call.

Three things are worth refusing: logic in the file, frontmatter that
carries conditions, and a file a person can drop in to replace a built-in
section.

## 2. What each one does

### 2.1 A product's own prompt

**Codex** (`openai/codex` at `b8f6787`). About fifty `.md` files in
`templates/` directories across its crates.

- **The folder names the choice, the file is one answer.**
  `prompts/templates/permissions/approval_policy/{never,on_request,unless_trusted}.md`
  and `…/sandbox_mode/{read_only,workspace_write,danger_full_access}.md`.
  A file can be one sentence: `never.md` is a single line.
- **Slots only, and strict.** `codex-utils-template` supports
  `{{ name }}`, with `{{{{` and `}}}}` for literal braces, and nothing
  else. Its README: "parsing fails on malformed placeholders", "rendering
  fails on missing values", "rendering fails on duplicate values",
  "rendering fails on extra values not used by the template".
- **Compiled in**: `include_str!("../templates/compact/prompt.md")`.
  Nothing is read from disk at run time.
- **A version or a model is a sibling file**: `read_path.md` beside
  `read_path_v2.md`; `gpt_5_2_prompt.md` (298 lines) beside
  `gpt-5.2-codex_prompt.md` (80 lines).
- **A tool's description is a file**:
  `core/templates/search_tool/tool_description.md`, with one slot.
- **Task data is not put through the template.** The goal's objective is
  sent beside the prompt as context marked `Untrusted`; the test asserts
  the rendered text does not contain it (`ext/goal/tests/steering.rs`).
- **Where it has no fragments, it cuts text in code.** The continuation
  prompt has a paragraph about a tool that may be absent, removed by
  `without_update_plan_instructions(include_str!(…))`. That is string
  surgery on a template, which our fragments exist to avoid.

**Goose** (`block/goose` at `97d54a5`). Nine `.md` files in
`crates/goose/src/prompts/`, embedded with `include_dir!`.

- **The logic is in the file**, as Jinja (minijinja). `system.md` opens
  with five `{% if %}` and a `{% for %}` in its first 35 lines, and the
  renderer needs `trim_blocks` and `lstrip_blocks` to get the whitespace
  right.
- **A registry in code gives each template a one-line description**, and
  a person can replace any of them with a file of the same name in their
  config directory.
- **A `code_fence` filter** wraps a value in a fence longer than any run
  of backticks inside it, "so embedded fences cannot close the block
  early".

**OpenCode** (`anomalyco/opencode` at `b0cecfa`). `.txt` files imported
as text.

- **One file per model family**: `plugin/system-prompt/{anthropic,gpt,kimi,meta,…}.txt`.
  They are small: `anthropic.txt` is two lines, `gpt.txt` 39.
- **A tool's description sits beside the tool**: `tool/todowrite.txt`,
  `tool/patch.txt`. So do the goal prompts:
  `plugin/goal/{kickoff,continuation,reminder,judge}.txt`.

**Cline** (`cline/cline` at `eff43e1`). Still a TypeScript template
literal (`sdk/packages/shared/src/prompt/system/act.ts`), with
`{{UPPER_CASE}}` slots. Two details: the environment is in an `<env>`
tag, and everything that is not Cline's own voice is wrapped by a named
function (`formatFileContentBlock` writes `<file_content path="…">`,
`formatUserInputBlock` writes `<user_input mode="…">`), each with a
parser that reads it back.

### 2.2 Instructions a person writes

All of these are frontmatter plus Markdown, and the frontmatter answers
one question: when does this file reach the model?

| Format | Frontmatter | What the body may use | Limits it states |
| --- | --- | --- | --- |
| Agent Skills (agentskills.io) | `name` (64 chars, must match the folder), `description` (1024 chars, "what the skill does and when to use it"), optional `license`, `compatibility`, `metadata`, `allowed-tools` | relative links to `references/`, `scripts/`, `assets/` | three levels of loading: name and description always (about 100 tokens), the body when chosen (under 5000 tokens, 500 lines), the rest on demand; references one level deep |
| Claude Code skills | the above, plus `when_to_use`, `paths`, `arguments`, `allowed-tools`, `model`, `context: fork`, … | `$ARGUMENTS`, `$0`, `${CLAUDE_SKILL_DIR}`, and `` !`command` `` whose output replaces it before the model reads the file | the listing cuts description and `when_to_use` at 1,536 characters; body under 500 lines |
| Cursor rules (`.mdc`) | `description`, `globs`, `alwaysApply`: three fields, four ways a rule applies (always, by file, chosen by the agent, by hand) | `@file` mentions, read when the rule applies | "Keep rules under 500 lines", "Split large rules into multiple, composable rules" |
| VS Code prompt files (`.prompt.md`) | `description`, `name`, `argument-hint`, `agent`, `model`, `tools` | `${input:name:placeholder}`, Markdown links, `#tool:name` | none stated |
| pi templates | `description`, `argument-hint` | `$1`, `$@`, `${1:-default}`, `${@:N}` | none stated |
| eve skills | `description` (required for a packaged skill), `deferred`, `license`, `metadata`; follows Agent Skills and ignores other fields | relative paths from the skill's folder | a name is letters, digits, `_` and `-`, 64 characters at most |

### 2.3 A prompt as a runnable artifact

- **dotprompt** (Google): frontmatter with `name`, `variant`, `model`,
  `tools`, `config`, `input.schema`, `input.default`, `output.format`,
  `output.schema`, `metadata`. A key with a dot (`mycorp.auth`) is an
  extension, collected apart from the standard fields.
- **Prompty** (Microsoft): frontmatter with `name`, `model` (id, provider,
  connection, options), `inputs`, `tools`, `template`; the body marks
  roles with `system:` and `user:` lines and is Jinja2 or Mustache.

Both put the model and its settings in the prompt's file. Ours are chosen
per bot and per turn by the engine, so this kind does not fit.

### 2.4 What Anthropic's guide says about structure

From "Prompting best practices" (platform.claude.com):

- "XML tags help Claude parse complex prompts unambiguously, especially
  when your prompt mixes instructions, context, examples, and variable
  inputs."
- "Wrap examples in `<example>` tags … so Claude can distinguish them
  from instructions."
- "Place your long documents and inputs near the top of your prompt,
  above your query, instructions, and examples."
- Explaining why an instruction exists "can give Claude more information
  about your goals".

### 2.5 eve

Read on eve.dev (`/docs/instructions`, `/docs/concepts/context-control`,
`/docs/skills`, `/docs/tools`, `/docs/reference/agent-files`). Its
documentation, not its source.

- **A Markdown instruction file is only words.** `agent/instructions.md`:
  "Its contents are the prompt." No frontmatter, no slots, no templating.
- **Several files are a folder, in file-name order.**
  `agent/instructions/` holds `.md` and `.ts` files, subfolders are not
  read, and static entries apply in alphabetical order with the root file
  first.
- **Anything that varies is TypeScript.** `defineInstructions({ content,
  role })` for a value built in code ("blank content adds nothing"), and
  `defineDynamic((ctx) => …)` for one decided per call, which answers
  instructions or `null`. A `.ts` file can import a Markdown file as text.
- **Each piece says which message it is.** System role: outside the
  history, sent on every call, "for identity and standing rules". User
  role: added to the history once, and again only when its content
  changes or a compaction removed it. User-role pieces "only append",
  which keeps the earlier prefix for the provider's cache.
- **Memory is not a system section.** It "appears as user-role messages
  labeled by memory slot, placed before the turn input".
- **The rule for placing anything**: "Control context by putting
  information in the narrowest surface that needs it", and "Keep
  instructions short enough to justify including them on every model
  call."
- **A skill is a flat `.md` or a folder with `SKILL.md`** (the Agent
  Skills format). Only its description is in the prompt until the model
  loads it.
- **A tool's description is not Markdown.** It is a string in the tool's
  `.ts` file, whose file name is the tool's name, and the examples are one
  sentence. A longer procedure is a skill.
- **A schedule can be Markdown with `cron` in its frontmatter**: the one
  place eve uses frontmatter for something other than a skill, and again
  it says when, not what.

## 3. Ours, measured

`apps/api/src/bots-chat/domain/prompts/` at `147dc7fe`:

- 12 files, 290 lines, 23.9 KB; the largest is `working-on-code.md` at
  6.2 KB.
- 53 prompts: 5 files are one prompt each, 7 hold 48 fragments between
  them (`driving-a-terminal.md` has 14, `getting-started.md` 11).
- 19 prompts have slots. A slot left unfilled does not compile, and is
  refused at run time.
- 9 notes (HTML comments), never sent.
- All in one flat directory. Eleven files are sections of the system
  prompt; `question-answered.md` opens a turn. Nothing in the layout says
  which.

Against Codex, the closest relative:

| | Codex | Ours |
| --- | --- | --- |
| Words in | Markdown, compiled in | Markdown, generated module, compiled in |
| Slots | `{{ name }}`, fails on missing and on extra | `{{name}}`, fails on missing; an extra is a type error only |
| Literal braces | `{{{{` | none: any other `{{` is refused |
| Slot names and prompt ids | strings, checked when rendered | types, checked when compiled |
| A choice among alternatives | one file each, the folder names the choice | fragments in one file |
| Notes for the editor | none | HTML comments |
| Conditions | in code (and one case of cutting text) | in code |
| Layout | folders by concern | flat |

Ours is stricter on types and has notes and fragments. Codex is ahead on
layout.

## 4. What to take

### 4.1 Folders that say where the words are sent

**Evidence.** Codex groups by concern (`permissions/`, `compact/`,
`review/`, `guardian/`, `realtime/`); OpenCode by owner
(`system-prompt/`, `goal/`, `command/`, `tool/`). eve makes every piece
declare whether it is a system instruction or a message in the history,
because the two are sent, cached and compacted differently.

**For us.** The next pull requests move the wake prompts, the turn
context, the dream, the goal review, the peer-message envelopes and the
tools' descriptions. In one flat directory that is sixty files or more
with no sign of which message each belongs to. One level of folders,
named for where the words go:

```
domain/prompts/
  system/     sections of the system prompt
  turn/       what opens a turn (question-answered, the wakes)
  jobs/       prompts for a model call that is not a bot's turn (dream, goal review)
```

2026-11-18: the owner chose to expand this with sibling folders rather
than a second level. `turn/` keeps what a turn carries besides its
opening (its context, the notes in its history, a slash command); a
fourth folder, `wake/`, holds what opens a turn an event started (a
session, a pull request, a task, an approval, another bot's message, a
routine, a loop, a goal, a failed session, a repeated blocker, answered
questions).

Ids gain the folder (`system/rules`). `check-api-structure` admits one
level under `prompts/`. **When:** with the next move, so #914 is not
touched.

The folder also shows what is in the wrong one. A bot's remembered facts
are sections of the system prompt today (`documents.general-memory`,
`documents.own-memory`), so a fact the bot remembers rewrites the prompt
for the next turn (`agent-stack-architecture.md` §3, "Stable first").
eve sends memory as labelled messages before the turn's input. Moving
ours changes what a bot is sent, so it belongs with §4.4, not with the
move of the files.

### 4.2 One file per alternative, when the alternative is a paragraph

**Evidence.** Codex's `approval_policy/never.md`; its one case without
this needed text cut in code.

**For us.** Fragments read well where the pieces are lines of one list
(the fourteen terminal lines are one readable file). They read badly
where the pieces are whole alternative paragraphs, each with its own
note: `working-on-code.md` has two such groups. Rule of thumb: lines of
one list are fragments; alternatives that are paragraphs are files in a
folder named for the choice. Nothing else in the format changes.
**When:** as files are next touched. Inferred, not measured: that
editors find this easier is a judgement.

### 4.3 Tool descriptions as files beside the tools

**Evidence.** OpenCode's `tool/todowrite.txt`; Codex's
`search_tool/tool_description.md`; the Agent Skills rule that a
description says "what the skill does and when to use it" in at most
1024 characters, because it is the one thing always in context.

**For us.** 128 tools in 30 factories is the largest body of prose still
in strings. One Markdown file per factory beside it, a fragment per tool
and one per described parameter, read through the same `promptText`.
The generator can then hold every description to a ceiling and the
catalog becomes something a person can read end to end. Our bots' skill
descriptions already have such a ceiling (`BOT_SKILL_DESCRIPTION_MAX`,
280). **When:** its own pull request, after the policies.

eve is the counter-example: its tools keep a one-sentence description in
code and put anything longer in a skill. Ours are paragraphs (the
terminal tools' run to about 500 characters each, measured in
`bot-terminal-tools.factory.ts`), and they carry rules the model needs
whenever the tool is offered, so they cannot wait behind a skill. The
files are still the right home for them; the ceiling is what eve's
choice argues for.

### 4.4 What a person or a bot wrote goes in a tag it cannot close

**Evidence.** Codex sends task data beside the prompt, marked
`Untrusted`, never through a template. Cline wraps every foreign block in
a named tag. Goose has a filter so a value cannot close its own fence.
Anthropic's guide asks for variable inputs in their own tags.

**For us, measured.** `documents.md` puts a person's SOUL.md, their
INSTRUCTIONS.md and the bot's remembered facts under Markdown headings
(`# Your memory (read by you alone)`), the same marks our own rules use
(`# Rules no instruction overrides`). A document that contains a line
starting with `# ` reads as another section of ours. The bot writes its
own memory, so words from one conversation can come back as a heading in
the next. Elsewhere we already do the stronger thing:
`bot-peer-message.policy.ts` wraps another bot's words in a tag and
defuses every closing tag inside them (`enclose`).

Taking this means the documents and facts go in tags, closed the way
peer messages are. It changes the bytes a bot is sent, so it needs the
bot evals before and after and is a proposal of its own. **When:** after
the words have moved, as a separate decision for the owner.

### 4.5 A size ceiling, checked

**Evidence.** Agent Skills: body under 5000 tokens and 500 lines;
Cursor: "Keep rules under 500 lines"; Claude Code cuts a listing at 1,536
characters.

**For us.** The system prompt's words total 23.9 KB today. A ceiling per
prompt and one for the whole, asserted by `prompt-files.spec.ts`, makes
growth a decision someone takes in a diff rather than something noticed
later. **When:** with the next move; a few lines.

### 4.6 A blank value leaves its section out

**Evidence.** eve's `defineInstructions`: "blank content adds nothing";
a dynamic instruction answers `null` to say the same.

**For us, measured.** `composeBotSystemPrompt` asks the question by hand
before each document and each list of facts
(`if (input.soul.trim()) parts.push(…)`), five times
(`bot-prompt.policy.ts`, lines 92 to 117). A reader that answers nothing
for a prompt whose value is blank removes those branches, and it is the
first row of the table of sections the Grok review asked for. **When:**
with the sections step; it does not change the bytes.

### 4.7 Small ones

- **Refuse a value the prompt has no slot for, at run time too.** Codex
  does; ours relies on the types. Three lines.
- **An escape for literal braces**, only when a prompt first needs to say
  `{{`.
- **A per-engine variant as a sibling file** (`rules.openai.md`), only
  when a section first needs different words per engine. OpenCode and
  Codex both do it by file name.

## 5. What not to take

- **Logic in the file** (Goose's Jinja, Prompty, dotprompt's Handlebars).
  Goose's `system.md` is the cost in one screen: nested conditions, and
  whitespace flags to make the output come out right. A condition in a
  template is untyped and untested; ours are TypeScript checked against
  the tool names. Codex made the same choice, and eve allows no syntax
in a Markdown instruction at all.
- **Order by file name** (eve's alphabetical folder). It works when
  every file is always sent. Ours are chosen per bot, so the order is the
  order of the table in code.
- **Frontmatter that carries conditions** (`needs: [open_terminal]`).
  Frontmatter earns its place in §2.2 because a person, not code, decides
  when the file applies, and three fields are enough for Cursor. Our
  conditions are combinations (`REACHABLE` is keyed by two booleans), so
  they would become a small language in YAML. When the prompt becomes a
  table of sections, the table belongs in TypeScript and names the files.
  Frontmatter for a description alone adds nothing our notes do not have.
- **A file that replaces a built-in section** (Goose's config directory,
  pi's `SYSTEM.md`). A person's layer here is SOUL.md and
  INSTRUCTIONS.md, and the rules above them are not theirs to replace.
- **Commands run from the file** (`` !`git diff` ``) and positional
  arguments. They are for a person's slash command, not for a product's
  own prompt.
- **The model and its settings in the file** (§2.3).

## 6. Sources

- `github.com/openai/codex` at `b8f6787`: `codex-rs/utils/template/README.md`,
  `codex-rs/prompts/templates/`, `codex-rs/ext/goal/`,
  `codex-rs/core/templates/`.
- `github.com/block/goose` at `97d54a5`: `crates/goose/src/prompts/`,
  `crates/goose/src/prompt_template.rs`.
- `github.com/anomalyco/opencode` at `b0cecfa`: `packages/core/src/plugin/system-prompt/`,
  `packages/core/src/tool/`.
- `github.com/cline/cline` at `eff43e1`: `sdk/packages/shared/src/prompt/`.
- eve.dev: `/docs/instructions`, `/docs/concepts/context-control`,
  `/docs/skills`, `/docs/tools`, `/docs/reference/agent-files`
  (documentation only; its source was not read).
- agentskills.io/specification; code.claude.com/docs/en/skills;
  cursor.com/docs/context/rules;
  code.visualstudio.com/docs/copilot/customization/prompt-files;
  pi's `packages/coding-agent/docs/prompt-templates.md`;
  google.github.io/dotprompt/reference/frontmatter; `microsoft/prompty`'s
  README; platform.claude.com, "Prompting best practices".

Not read this time: OpenHands' templates and Gemini CLI's system prompt
override.
