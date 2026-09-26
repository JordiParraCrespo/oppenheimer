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
```

A new API error code needs a row in `docs/errors.md`; the convention is [`.agents/rules/nestjs-architecture.md`](../../.agents/rules/nestjs-architecture.md).
