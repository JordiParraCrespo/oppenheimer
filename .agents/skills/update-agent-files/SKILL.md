---
name: update-agent-files
description: Review and update the agent files (root and per-package AGENTS.md, .agents/rules/, .agents/skills/, .claude/settings.json and .agents/hooks/) after a code or agent-file change, so what they say matches the code. Use after changing a pattern, a convention, a module or package layout, a command, or a rule or skill itself. The final closeout before a commit is `sync-docs`, which covers this and the docs site.
---

# Keeping the agent files true

The agent files are instructions, so a stale one is worse than a missing one:
it tells the next session to do the wrong thing with confidence. This pass
finds what a change made untrue and corrects it, and changes nothing else.

Every `CLAUDE.md` is a symlink to the `AGENTS.md` beside it, and `.claude/rules`
and `.claude/skills` are symlinks to `.agents/rules` and `.agents/skills`:
edit the `.agents/` file or the `AGENTS.md`, never the link.

## Step 1: What changed

`git diff --name-only` for uncommitted work; if empty,
`git diff origin/main...HEAD --name-only` for the branch. If both are empty,
say there is nothing to review and stop. Read enough of the diff to know what
changed in concept (a new module, a renamed port, a new command, a removed
convention), not only which files.

## Step 2: Map each path to the files that describe it

| Changed path | Agent files that may describe it |
| --- | --- |
| `apps/api/**` | `apps/api/AGENTS.md`, `apps/api/ARCHITECTURE.md`, `.agents/rules/nestjs-architecture.md`, `nestjs-di.md`, `api-config.md`, `rbac-roles.md`, `scopes-and-credentials.md`, `feature-flags.md`, `integrations.md`, the `scaffold-module` skill |
| `apps/api/src/migrations/**`, `*.orm-entity.ts` | `.agents/rules/typeorm.md`, `database-design.md`, the `design-database` skill |
| `apps/api/.dependency-cruiser.cjs`, `scripts/check-api-structure.mjs` | `apps/api/ARCHITECTURE.md` (the module contract lives there, once), `nestjs-architecture.md` |
| `packages/backend/<pkg>/**` | that package's `AGENTS.md` and `README.md`, `.agents/rules/backend-packages.md`, `nestjs-architecture.md` for `ddd` and `core` |
| `**/__tests__/**`, `*.spec.ts` (backend) | `.agents/rules/testing-backend.md`, the `test-audit` skills |
| `packages/frontend/**`, `apps/web/**` | `packages/frontend/ARCHITECTURE.md`, `apps/web/ARCHITECTURE.md`, the package's `AGENTS.md`, `.agents/rules/frontend-architecture.md`, `frontend-ui.md`, `forms.md`, the `scaffold-feature` and `tanstack-routing` skills |
| `packages/shared/**` | `packages/shared/AGENTS.md`, `forms.md`, `feature-flags.md`, `scopes-and-credentials.md`, `rbac-roles.md` |
| `apps/runner/**`, `packages/go/**` | `apps/runner/AGENTS.md`, `apps/runner/ARCHITECTURE.md`, `packages/go/README.md`, `.agents/rules/go.md` |
| `.agents/rules/**` | root `AGENTS.md` (the rule list under "Backend"/"Frontend"), every rule that links the changed one |
| `.agents/skills/**` | root `AGENTS.md` where it names the skill, `scripts/starter/features.json` when the skill belongs to an optional app |
| `.claude/settings.json`, `.agents/hooks/**` | root `AGENTS.md` (the guardrails and CI bullets) |
| `scripts/ci/**`, `.github/workflows/**` | root `AGENTS.md` (CI is local), the `steward` skill, `.agents/routines/main-red.md` |
| a new or removed directory under `apps/` or `packages/` | root `AGENTS.md` (structure tree, dependency flow), `scripts/starter/features.json`, and the new directory's own `README.md`, `AGENTS.md` and `CLAUDE.md` symlink |
| a new environment variable | root `.env.example`, with a note (`api-config.md`) |

If nothing maps, say the agent files are in sync and stop.

## Step 3: Read and compare

For each candidate, read the file in full and the code it describes, then
look for:

- examples, paths, type names, imports or commands that no longer exist;
- a structure tree or list that misses what was added or still shows what was
  removed;
- a convention the change replaced, or a new one it introduced that a later
  session needs to know to not break it;
- a rule that restates a contract owned elsewhere (`ARCHITECTURE.md`, a
  check script): point at the owner instead of fixing the copy.

## Step 4: Propose, then apply

List each edit as file, section, what is wrong, and the fix. Corrections of
fact can be applied straight away; a new rule or skill, or a removed one, is
proposed first. Then edit one file at a time:

- change facts (examples, paths, names, trees, command tables, behavior), and
  keep the file's voice, heading levels and format;
- a new rule carries a `paths` frontmatter scoped like its neighbours and gets
  a line in the root `AGENTS.md` list; a new skill gets a `SKILL.md` with
  `name` and `description` frontmatter and is named where the root `AGENTS.md`
  sends work to it;
- a line that mentions an optional app is wrapped in
  `# oppenheimer:begin <id>` / `# oppenheimer:end <id>` (or the comment syntax
  of the file); `pnpm starter:check` fails otherwise.

## Step 5: Check the cross-references

- Every rule or skill a file links still exists at that path.
- The root `AGENTS.md` rule list matches `.agents/rules/`, and every skill it
  names is in `.agents/skills/`.
- `pnpm check` (Biome formats Markdown it owns and JSON) and
  `pnpm starter:check` pass.

## Rules

- **Bias toward no change.** A localized fix rarely changes what an agent file
  says. Do not edit to look thorough.
- **Document what exists.** Read the source; never write a pattern the code
  does not follow.
- **Never remove a rule on one example.** Check broadly before deleting a
  convention.
- **A decision is not an agent-file edit.** When the change reverses a product
  decision, that goes in the note under `product/` that made it and in the
  "decisions that changed" list in `product/README.md` (root `AGENTS.md`).
