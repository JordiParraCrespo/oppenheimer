# @oppenheimer/docs — Agent Instructions

Docusaurus documentation site.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first for repo-wide conventions.

## Stack

- **Docusaurus** — config in `docusaurus.config.ts`, nav in `sidebars.ts`
- Markdown/MDX content in `docs/`
- Custom React/CSS overrides in `src/`, static assets in `static/`
- Shipped as a static site (Dockerfile for container hosting)

## Layout

```
docs/                 # documentation pages (Markdown/MDX)
src/css/              # theme overrides
static/               # images and static assets
docusaurus.config.ts  # site config
sidebars.ts           # sidebar/navigation
```

## Commands

```bash
pnpm --filter @oppenheimer/docs dev     # local dev server
pnpm --filter @oppenheimer/docs build   # static build
pnpm --filter @oppenheimer/docs serve   # serve the build
pnpm generate:guide                     # bundle docs/guide for the bots (check:guide verifies)
```

## The guide is what bots know

`docs/guide/` is "Using Oppenheimer", the user guide, and it has a second
reader: every bot in the product reads these exact pages through its
`read_oppenheimer_docs` tool before it answers a question about Oppenheimer
(`product/versions/mvp/25-bots.md` §4.1, "Oppenheimer's own guide"). So:

- Write only what is built, where it is in the console, and its limits; a
  bot repeats what a page says as fact.
- Each page carries `title`, `description` (one specific sentence: it is
  the page's entry in the index a bot picks pages from) and
  `sidebar_position`. Plain Markdown, no MDX components; link other pages as
  `./<id>.md`.
- A bot reads a page in one tool answer, which holds 12,000 characters
  (`bot-guide.policy.spec.ts` fails past it): split a page that grows near it.
- After an edit run `pnpm generate:guide`, which writes the pages into
  `packages/shared/src/guide/guide-pages.gen.ts` for the API, and commit
  both. `check:guide` (in `pnpm ci:local`) fails when they differ.
- The build also writes `/llms.txt` and each page as `/guide/<id>.md`
  (`scripts/llms-txt.mjs`), for agents outside Oppenheimer.

A new API error code needs a row in `docs/errors.md`; the convention is [`.agents/rules/nestjs-architecture.md`](../../.agents/rules/nestjs-architecture.md).
