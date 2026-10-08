---
name: sync-docs
description: Closeout step for a finished change, before the commit. Decides whether it needs the documentation site (apps/docs, Docusaurus), an AGENTS.md or ARCHITECTURE.md, a rule or skill, a product decision note, a changeset or the root .env.example updated, and applies the minimal edits. Use as the last step after implementing and verifying a feature or fix; `update-agent-files` is the deeper pass over the agent files alone.
---

# Closing out a change

Run this last, once the change is complete and verified. It answers one
question for each surface that describes the code: did this change make it
untrue or incomplete? It covers the agent files too, so it does not need
`update-agent-files` first; run that one on its own for a deeper pass.

## Step 1: What changed

`git diff --name-only` for uncommitted work; if empty,
`git diff origin/main...HEAD --name-only` for the branch. If both are empty,
say there is nothing to sync and stop. Group the paths by area (API, backend
packages, frontend, runner and Go, shared, agent files, root config) and read
enough of the diff to name what changed in concept.

## Step 2: Is anything owed at all?

Most changes owe nothing: a localized fix, an internal refactor, a test-only
change. Something is owed only when the change alters one of:

- the workspace layout (an app or package added, removed or renamed);
- a command, a script or an environment variable;
- a documented architecture, pattern, convention or workflow;
- a public surface: an endpoint, an error code, a DTO, an exported hook, a
  package export;
- an example, path, type or import that a rule or doc quotes;
- a product decision recorded under `product/`.

If none applies, say so and stop.

## Step 3: The owed items, by owner

Each fact has one owner. Update the owner; a page elsewhere links to it and
does not grow a copy.

| What changed | Where it is written |
| --- | --- |
| a module's layers, the module contract, a cookbook step | `apps/api/ARCHITECTURE.md` (also `apps/runner/ARCHITECTURE.md`, `apps/web/ARCHITECTURE.md`, `packages/frontend/ARCHITECTURE.md`) |
| what an agent must know to work in a directory | that directory's `AGENTS.md` (the `CLAUDE.md` beside it is a symlink) |
| a package's purpose, exports, usage | the package's `README.md` |
| a convention scoped to some paths | the rule in `.agents/rules/` |
| a new API error code | a row in `apps/docs/docs/errors.md`, plus the four steps in `nestjs-architecture.md` |
| a new environment variable | the root `.env.example`, with a note (`api-config.md`) |
| a change to a published package (`packages/*`) | a changeset in `.changeset/` (`pnpm changeset`) |
| a product decision that changed | the note in `product/` that made it, a line in the "decisions that changed" list in `product/README.md`, and `product/brief.html` regenerated |
| an MVP area's design | its document in `product/versions/mvp/` and that folder's decision log |

Never rewrite an earlier note to hide that a decision changed; add the line
that says it did.

## Step 4: The documentation site

`apps/docs` is a **Docusaurus** site: pages are Markdown under
`apps/docs/docs/`, navigation is `apps/docs/sidebars.ts`. Read
`apps/docs/AGENTS.md` first. Check the pages against the diff:

| Page | Update when |
| --- | --- |
| `intro.md` | an app or package family was added or removed |
| `getting-started/installation.md` | a prerequisite, an install step or a run command changed |
| `getting-started/project-structure.md` | the workspace layout changed |
| `architecture/overview.md` | how the apps fit together changed |
| `architecture/api-architecture.md`, `backend-packages.md` | the API's shape or a backend package's role changed |
| `architecture/frontend-architecture.md`, `query-keys.md`, `analytics.md` | the frontend tier, its query keys or analytics changed |
| `architecture/go-services.md` | the runner or a Go module changed shape |
| `errors.md` | an error code was added, changed or retired |
| `deployment/*.md` | the deployment changed (the runbook itself is `deploy/dev/README.md`) |

A new page is a Markdown file with front matter and an entry in
`sidebars.ts`; a sidebar entry for a page that does not exist fails the build.
A page or sidebar line about an optional app sits inside its
`oppenheimer:begin`/`oppenheimer:end` markers. Do not add pages mid-task that
nobody asked for.

## Step 5: The agent files

Map the changed paths to the agent files with the table in
[`update-agent-files`](../update-agent-files/SKILL.md) (Step 2) and apply its
Steps 3 to 5 to the ones the change touched.

## Step 6: Summarize, apply, verify

List each edit (file, section, what is wrong, the fix), then apply them one
file at a time, changing facts and keeping each file's voice and format. Then:

- every link to a rule, skill, page or file resolves;
- the root `AGENTS.md` rule and skill mentions match `.agents/rules/` and
  `.agents/skills/`;
- `pnpm check` and `pnpm starter:check` pass, and
  `pnpm --filter @oppenheimer/docs build` passes when a page or the sidebar
  changed.

Report the files updated and why, or that docs and agent files were already
in sync.
