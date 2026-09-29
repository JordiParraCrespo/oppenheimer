---
name: deslop-campaign
description: "Repo-wide deslop campaign: run the comments-only deslop standard over the whole codebase area by area, in repeated passes, each pass stricter than the last, with a ledger of what each pass covered and cut. Use when asked to run, continue or plan the deslop campaign, to deslop the whole repo, or to do another cleanup pass over an area."
---

# Deslop campaign

The repo-wide counterpart of `/deslop`, modelled on openclaw's deslop
campaign (area-by-area passes, each one cumulative over the last). `/deslop`
cleans a branch diff; the campaign cleans the tree, one area and one pass at a
time, and `ledger.md` beside this file records where it stands.

The edit rules are `/deslop`'s (`.agents/skills/deslop/SKILL.md`): comments
only, behavior-neutral, everything else reported. The campaign adds scope,
depth and bookkeeping, not a licence to touch code. The one code edit it allows
is the one `/deslop` allows: a rename that moves a constraint out of a comment
into an identifier (`CURVE25519_P`).

## A pass

1. **Pick the areas.** Read `ledger.md`. A pass covers every area in it; an
   area is one slice a subagent can read in full (roughly 1–2.5k comment
   lines). Split an area that grew; add a row for a new directory.
2. **Fan out.** One subagent per area, all in parallel, each given its paths,
   the pass's rubric (below) and the keep list. Subagents edit, never commit,
   and never touch another area's files.
3. **Verify.** Every changed line is a comment or blank line (the rename
   aside):

   ```bash
   git diff -U0 | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' \
     | grep -vE '^[+-]\s*(//|/\*\*?|\*|\*/|\{/\*.*\*/\})' | grep -vE '^[+-]\s*$'
   ```

   prints nothing. Then `pnpm ci:local`, green.
4. **Record.** Update `ledger.md`: per area, the pass, files changed, lines
   removed, and anything reported rather than fixed. Commit the ledger with
   the pass.
5. **Ship.** One pull request per pass (or per area, when a pass is too big to
   review), driven by `.agents/skills/steward/SKILL.md`; the body lists what
   was reported.

## The rubric, by pass

Each pass applies everything the passes before it did, plus its own cut.

- **Pass 1: restatement.** Comments that repeat the next line or the name
  they sit on; dividers that repeat the heading below them; doc comments on
  the wrong symbol.
- **Pass 2: depth.**
  - One-line JSDoc that paraphrases the class, method or field name
    (`/** Deletes a workspace. */` on `DeleteWorkspaceCommandHandler`), even
    where it is the local convention.
  - The same note said twice (a prop and its getter, a port and its adapter,
    an interface and its implementation): keep the one on the declaration a
    reader meets first.
  - Inside a long block, sentences that say *what* the code below does, when
    the block's *why* sentences survive on their own. Trim; do not delete the
    block.
  - Test narration that restates the `it(...)` title or the assertion under
    it.
  - Comments that explain the language or framework (what `readonly`,
    `useEffect`, `@Injectable()`, `defer` do).
- **Pass 3 and later: consolidation.** Notes repeated across files move to
  the one module that owns the rule and the others drop them. Blocks that
  grew into essays are rewritten to their constraint.

## Never cut

A comment that is the only place a reader learns a unit, a magic number's
meaning, an ordering or locking rule, a security reason, a platform quirk, a
regression a test guards, or a pointer to a product note. Directives
(`biome-ignore`, `@ts-expect-error`, `//go:`, `//nolint`,
`oppenheimer:begin/end`), Go doc comments on exported identifiers, TODOs,
license headers, generated files, and the eval fixtures under
`scripts/evals/*/cases/` whose comments are part of the case.
