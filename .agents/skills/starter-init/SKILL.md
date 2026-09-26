---
name: starter-init
description: Turn the Oppenheimer starter into the user's project. Use on a fresh clone when the user asks to initialize, bootstrap, set up, or trim the starter, says "start my project", or asks which apps they need. Holds a short dialog to understand what they are building, proposes which apps and tools to keep, then prunes everything else with scripts/starter/prune.mjs and rewrites the docs so no dead reference survives.
---

# Initialize a project from the starter

Oppenheimer ships every app it knows how to build. A real project needs a few of
them. This skill finds out which, removes the rest cleanly, and leaves the
repo reading as if it had always been that shape.

The mechanical part is `scripts/starter/prune.mjs` and its manifest
`scripts/starter/features.json`. **Never delete an app by hand** — the
manifest knows the machine-read places (CI, compose, Helm, `.env.example`,
the JSON configs, the code the API carries for a deleted app) that mention
each feature. Your job is the part a script cannot do: the conversation, the
decision, and the prose.

## 1. Understand the project (dialog)

Ask, one question at a time, and stop as soon as you can answer the rest
yourself. Do not run the interview as a checklist; skip anything the user
already told you. Most briefs answer half of these up front; aim to ask four
or five.

1. **What are you building?** One or two sentences: the product, who uses it.
2. **Where will people use it?** Browser, phone, both, or only through an API
   or agents. This decides `web` / `mobile`.
3. **Will you run it for other people?** A team that manages users, roles and
   permissions wants the control plane (`admin-web`, `admin-mobile`). A
   single-tenant tool or a personal project usually does not.
4. **Does anything need to run outside Node?** Long-lived connections,
   process orchestration, containers, VMs → `runner` (Go). Otherwise the
   NestJS API is the whole backend.
5. **Will agents or scripts drive it?** A CLI or MCP server only earns its
   place when the user or their customers will automate the product. Both
   need the scope catalog, which stays in the API either way.
6. **Where does it deploy?** Docker Compose on one box (Tier 1) needs no
   Helm chart. Kubernetes keeps `helm`.
7. **Project hygiene.** A docs site (`docs`), API and browser end-to-end
   tests (`e2e`), and the scenario-driven QA pack (`qa`). Most projects keep
   the first two and drop `qa`; the design-system showcases
   (`web-showcase`, `mobile-showcase`) go unless the user will evolve the
   design system itself.

Then `node scripts/starter/prune.mjs --list` shows the exact ids; read
`scripts/starter/features.json` for what each one drags along
(`requires`, and the `shared` packages that go when nobody needs them).

## 2. Propose, then confirm

Present one table: feature, keep or remove, and the reason in the user's own
terms ("you said only a browser app, so the Expo apps go"). Recommend a
default for each; the user decides. Defaults that fit most projects:

| Keep by default | Remove unless asked for |
| --- | --- |
| `web`, `docs`, `e2e` | `mobile`, `admin-mobile`, `mobile-showcase` |
| `admin-web` when there are admins | `web-showcase`, `runner`, `cli`, `mcp`, `qa`, `helm` |

Wait for the user to agree before touching anything. This is the one
question that must block: a prune is a large deletion, and undoing it is a
`git checkout`, not a click.

## 3. Prune

```bash
node scripts/starter/prune.mjs --keep <ids> --dry-run   # show the plan
node scripts/starter/prune.mjs --keep <ids>             # do it (runs pnpm install)
```

Prefer `--keep`: it names what the user asked for and pulls in what those
features require (`qa` keeps `web`, `admin-web` and `e2e`). `--without` is
for the rare "everything but X" prune.

The script deletes the feature paths, drops the marked blocks in every config
file and in the API code that existed for a removed app, edits the JSON files
that cannot carry markers (root `package.json` scripts and overrides,
`turbo.json`, `biome.json`, `apps/api/package.json`, `.changeset/config.json`),
rewrites pending changesets that name a removed package, refreshes the
lockfile, and prints the remaining mentions of the removed features. It also
removes itself and this skill, and strips every marker, kept features
included: markers exist only to serve the prune and are not meant to survive
it. Pass `--keep-tooling` only when the user wants a second pass later.

Then prove the trimmed repo is whole:

```bash
pnpm build && pnpm check && pnpm test
pnpm arch                      # the API is always kept
pnpm exec changeset status     # the one thing the build does not catch
```

Fix what fails before going on. A failure here is the script's bug or a
manifest gap, not something to paper over — fix it in the repo and, if the
manifest was wrong, say so in the final message so it gets upstreamed.

## 4. Rewrite the prose

The script's closing report lists the lines that still mention removed
features by path or package name. It is a floor, not a ceiling: after
working through it, grep for each removed app's plain nouns (`mobile`,
`Expo`, `native`, `MCP`, `CLI`, `Helm`, `Kubernetes`, `Go`, `runner`) and
for anything only that app used (`@better-auth/expo`, `EXPO_PUBLIC_`,
`react-native`, `RUNNER_`), excluding changelogs. Work through:

- `AGENTS.md` (also `CLAUDE.md`, a symlink): the monorepo tree, the
  conventions sections for removed apps, the dependency flow, the commands,
  the "when modifying code" bullets that name removed apps. Redraw the tree
  so the `├──`/`└──` connectors are right.
- `README.md`: the "what's included" table, the services table, the scripts.
- `AUTHORIZATION.md`: the design document names every app in its diagrams
  and phase plans.
- `apps/docs/docs/**` when `docs` is kept: `intro.md`,
  `getting-started/*.md` (the Google sign-in page has a whole mobile
  section), every `architecture/*.md`, `deployment/tier-1-cheap.md`, and
  `errors.md`.
- `.agents/rules/*.md`: a `paths:` glob or a sentence pointing at a removed
  app. Delete the rule if nothing it governs remains.
- Per-package `README.md` / `AGENTS.md` files that list consumers, including
  `packages/tsconfig`, `packages/auth`, `packages/env`, `packages/frontend`,
  `packages/translations`, `packages/frontend/design-system/*`, and the kept apps'
  own `AGENTS.md`.
- `.env.example`: the header comment lists what each section serves.
- Code comments that name a removed app (`apps/web/nginx.conf`,
  `packages/frontend/design-system/web/src/components/icons.tsx`, and whatever the
  grep finds): reword, do not leave a pointer to a path that no longer
  exists.

Do not leave a sentence that says "web and mobile" when only web exists.
Do not add a "removed by init" note anywhere: the repo should read as if it
were born this way.

## 5. Make it theirs

Only if the user gave a project name: rename the brand. `oppenheimer` appears in
package names (`@oppenheimer/*`), Docker image names, the deep-link schemes, the
Helm release, the docs title, `packages/translations`, seed accounts
(`superadmin@oppenheimer.dev`), Postgres credential defaults, the API-token prefix
(`oppenheimer_pat_`, a wire-visible contract), the session preload global, and in
**filenames** (`oppenheimer.ts`, `oppenheimer-provider.tsx`, `oppenheimer-app.ts`: `git mv`
them). Change it everywhere at once, case-preserving, or leave it entirely —
a half-renamed repo is worse than either. Rename `CHANGELOG.md` headings and
pending `.changeset/*.md` frontmatter too: they are keyed by package name and
`changeset version` breaks otherwise. Afterwards `pnpm install` (the lockfile
carries the package names) and `pnpm generate:api-client` (the OpenAPI
examples carry the token prefix), and check that no second brand survives:
the design system's own `AGENTS.md` names the visual language it was built
on.

## 6. Finish

- `pnpm check` once more; commit as `chore: initialize project from the
  starter` (one commit, so the deletion is easy to read and revert).
- Tell the user what was kept, what was removed and why, and the two or
  three things they should do next (copy `.env.example`, set the secrets,
  point CI at their registry).
