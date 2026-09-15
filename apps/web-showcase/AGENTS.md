# @oppenheimer/web-showcase — Agent Instructions

Next.js showcase/gallery for the **web** design system.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first for repo-wide conventions.

## Purpose

A living catalog that renders the components and blocks exported by
`@oppenheimer/design-system-web` so they can be browsed and visually reviewed. This
is a demo surface — it does not hold product business logic.

## Stack

- **Next.js** (App Router) — `src/app/`
- **Tailwind CSS** + shadcn components from `@oppenheimer/design-system-web`

## Layout

```
src/app/
├── layout.tsx
├── page.tsx
├── components/       # component gallery page
└── blocks/           # composed-block gallery page
src/components/       # showcase chrome (sidebar, etc.)
```

## Commands

```bash
pnpm --filter @oppenheimer/web-showcase dev
pnpm --filter @oppenheimer/web-showcase build
```
