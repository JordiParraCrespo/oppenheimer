---
name: deslop
description: "Diff-scoped AI-slop cleanup pass: strip comment slop, defensive-check slop, type-laundering, and style drift from the current branch diff before review. Use before opening or updating a pull request, or when asked to deslop, clean up, or strip unnecessary comments from a change."
---

# Deslop

Adapted from openclaw's `deslop` skill (`openclaw/openclaw`, `.agents/skills/deslop/`).

Clean only the current branch diff before review. Preserve behavior absolutely.

## Checklist

1. Scope the pass to `git diff` against `origin/main`, or the branch merge base when it differs. Never run a repo-wide cleanup unless the user asks for one by name, and then only for the paths they name.
2. Inspect every changed hunk for:
   - comments a human maintainer would not write, including narration, syntax explanation, and prose that merely restates the code. Keep the comments that say why: a constraint, an invariant, a failure the code avoids, a decision a reader would otherwise undo. Keep Go doc comments on exported identifiers, directives (`biome-ignore`, `@ts-expect-error`, `//go:`, `eslint-disable`), and license headers;
   - defensive checks or `try`/`catch` blocks that are abnormal for the surrounding module or protect only imagined states;
   - casts that launder types, especially `as any`, `as unknown as T`, and widen-then-assert flows;
   - redundant intermediate variables or one-use helpers that do not add domain meaning, reduce duplication, or simplify control flow;
   - compatibility shims, aliases, retries, and fallback branches without a named shipped contract and removal plan;
   - naming, control flow, imports, formatting, and other style that conflicts with the surrounding file.
3. Make no functional edits. If cleanup could change behavior, leave it alone and report it instead.
4. Fix a finding inline only when the cleanup is trivial and behavior-neutral. Otherwise note it for the author.
5. Report the result in 1–3 sentences, including whether anything changed and any non-trivial item left for review.

Run `/deslop` before `/code-review`, never instead of it. The review and `pnpm ci:local` remain the correctness gate.
