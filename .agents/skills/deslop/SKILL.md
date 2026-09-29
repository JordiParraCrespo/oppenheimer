---
name: deslop
description: "Comments-only cleanup of the current branch diff: strip comments that narrate or restate the code, dividers that repeat the heading under them, and doc comments stranded on the wrong symbol. Behavior-neutral; everything else it notices is reported, not edited. Use before opening or updating a pull request, or when asked to deslop or strip unnecessary comments."
---

# Deslop

Adapted from openclaw's `deslop` skill (`openclaw/openclaw`, `.agents/skills/deslop/`),
cut down to the one pass that cannot change behavior: comments.

## Scope

The branch diff: `git diff` against `origin/main`, or the merge base when it
differs. A wider run only when the user asks for one, and then only the paths
they name.

## Edit

Only comments, and only these:

- a comment that restates the line under it, narrates syntax, or repeats the
  name of what it sits on;
- a divider or banner that repeats the `describe`, heading or `GroupHead`
  right below it;
- a doc comment stranded on the wrong symbol: move it back onto the one it
  names, and drop it if that symbol already carries the same note.

When a comment names a constraint the code does not show (a unit, a magic
number, an ordering, a platform quirk), keep it, or move its meaning into an
identifier (`CURVE25519_P`, not `P` under `/** 2^255 - 19 */`) and then drop
it. Never leave a bare field in a shared contract whose unit or construction
rule only the deleted comment gave.

Always keep: comments that say why, Go doc comments on exported identifiers,
directives (`biome-ignore`, `@ts-expect-error`, `//go:`, `//nolint`,
`oppenheimer:begin/end`), TODOs and license headers.

## Report, never edit

Whatever else looks like slop is left in the diff and listed in the pull
request body, one line each: casts that launder types (`as any`,
`as unknown as T`), defensive checks and `try`/`catch` for states that cannot
happen, one-use helpers, compatibility shims, retries and fallbacks with no
named contract. Removing any of them changes behavior, so it is a code change
with its own review, not cleanup.

## Finish

Say in 1–3 sentences what changed and what was reported. Then drive the pull
request as `.agents/skills/steward/SKILL.md` says; `pnpm ci:local` is the
gate, and a deslop pass never replaces it.
