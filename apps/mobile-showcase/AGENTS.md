# @oppenheimer/mobile-showcase — Agent Instructions

Expo showcase/gallery for the **mobile** design system.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first for repo-wide conventions.

## Purpose

A living catalog that renders the components exported by
`@oppenheimer/design-system-mobile` on a real device/simulator so they can be
browsed and visually reviewed. Demo surface only — no product business logic.

## Stack

- **Expo** + **expo-router** (`app/`)
- **NativeWind** (Tailwind for React Native)
- Components from `@oppenheimer/design-system-mobile`; component metadata in `registry/`

## Layout

```
app/                  # expo-router screens
registry/             # showcase component registry
app.config.ts         # Expo config
metro.config.js       # monorepo-aware Metro config
```

## Commands

```bash
pnpm --filter @oppenheimer/mobile-showcase dev
pnpm --filter @oppenheimer/mobile-showcase ios
pnpm --filter @oppenheimer/mobile-showcase android
```
