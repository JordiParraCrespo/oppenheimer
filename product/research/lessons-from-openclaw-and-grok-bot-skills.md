# Lessons from OpenClaw and Grok Bot: skills and slash commands (2026-10-31)

The owner asked how OpenClaw and Grok Bot support skills, and for bots here
to run them as slash commands. This note reads both products' published
docs; no code is taken. What was seen on a fetched page is marked as such;
the rest is inference and says so. What `versions/mvp/25-bots.md` built from
it is §4.1, "Skills".

Sources: `docs.openclaw.ai/tools/skills`, `docs.openclaw.ai/tools/slash-commands`,
`docs.x.ai/grok-bot/overview`, `docs.x.ai/grok-bot/skills-routines-and-automations`,
`docs.x.ai/grok-bot/bots`, `docs.x.ai/grok-bot/shared-bots`,
`docs.x.ai/grok-bot/chat-and-collaboration`. Neither OpenClaw's repository
nor ClawHub was read.

## 1. OpenClaw (seen on its docs)

- **A skill is a folder with a `SKILL.md`**: YAML frontmatter, then a
  Markdown body (the AgentSkills format). The frontmatter's `name` (else the
  folder's) is its command; `description` is required and is what the
  prompt shows.
- **Who may run it is two booleans.** `user-invocable` (default true) makes
  it a slash command. `disable-model-invocation` (default false) keeps it out
  of the prompt, so the model never picks it on its own; the person still
  can. `command-dispatch: tool` with `command-tool` sends a command straight
  to a tool, skipping the model, with the raw argument string.
- **The prompt lists, the model reads on demand.** Eligible skills go into
  an `<available_skills>` block in the system prompt, name, description and
  location each, about 24 tokens a skill before those fields; past a
  character budget the descriptions are cut, then dropped. The full
  `SKILL.md` is read with a tool (`skills_read`) when used; `skills_search`
  finds one.
- **Where skills come from**, highest first on a name clash: the workspace's
  `skills/` and `.agents/skills/`, the person's `~/.agents/skills`, the
  managed directory (`~/.openclaw/skills`), per-agent skills, bundled ones,
  extra directories and plugins. A per-agent allowlist replaces the default
  list; `[]` is no skills.
- **Gating**: `metadata.openclaw` names the OS, binaries and environment a
  skill needs; one that cannot run is not offered. Not a security boundary,
  the docs say, and third-party skills are "untrusted code".
- **Slash commands.** Only user-invocable skills become commands, their
  names sanitised to `a-z0-9_` and at most 32 characters. A clash with a
  built-in command is renamed (`/dashboard_2`); `/skill <name> [input]`
  always works as the generic entry point. By default a command "routes to
  the model as a normal request" with what followed it.
- **ClawHub** is a public registry (`openclaw skills install @owner/slug`).

## 2. Grok Bot (seen on xAI's docs)

- **A skill is "a reusable set of instructions for how to do a task"**:
  when to use it, its inputs and access, the steps, how to check the result,
  what to return, and which actions need approval. No file format is shown.
- **Made in chat or by showing.** "Save the process we just used as a skill
  called…" saves one; **Teach a task** records up to ten minutes of the
  screen into a draft to refine. Editing is done by talking to the bot.
- **One private library, enabled per bot** (Connect apps → Private skills);
  a skill can be published to a team. Duplicating a bot copies the skills
  it has enabled, not its history or memory.
- **Invoked by name** ("ask for a saved skill by name"). The fetched pages
  show no `/` menu; a third-party article says one exists. Not confirmed.

## 3. What 25 §4.1 takes

| Idea | Where it lands |
|------|----------------|
| Name and description in every prompt, the body read only when used | the prompt's "Your skills" section and `use_skill` |
| `user-invocable` and `disable-model-invocation` | `userInvocable` and `modelInvocable` on each skill, at least one on |
| `/<name> args` routes to the model with the skill, and `/skill <name>` as the generic entry | the turn's message opens with the skill when the person runs it; `skill` is a reserved name |
| Names sanitised, 32 characters at most | lowercase, digits and hyphens, typed into shape as written |
| Grok Bot's "save that as a skill" in chat | `save_skill`, which the bot uses when asked; the person sees and edits it in Settings → Skills |
| Grok Bot's shape of a good skill | the editor's description and the tool's guidance |

## 4. What it does not take

- **Skills on disk, and their precedence.** A bot lives in Postgres; a skill
  is a row of the bot's, so it goes with the bot and needs no loader.
- **Gating on binaries and environment, and `command-dispatch: tool`.** A
  bot has no shell, and its tools already decide what it may do; a skill is
  how to do the work, never permission to do more.
- **A registry and a shared library.** Skills are a bot's own for now; a
  library shared by a person's bots, as Grok Bot keeps, is the obvious next
  step, on the same rows.
- **Teach a task.** There is no screen to record.
