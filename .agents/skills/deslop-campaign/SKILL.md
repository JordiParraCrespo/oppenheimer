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

   prints nothing. Then re-read every removed sentence, in deleted and in
   rewritten blocks alike, and restore the ones whose reason now lives nowhere
   a reader of that code would find it (grep for it; do not assume); check
   every corrected comment against the code. Then any eval planter
   (`.agents/routines/evals/*/plant.mjs`) still finds its anchors, and
   `pnpm ci:local` is green.
4. **Record.** Add the pass's column to `ledger.md`: net comment lines removed
   per area. The ledger is that table and nothing else.
5. **Ship.** One pull request per pass (or per area, when a pass is too big to
   review), driven by `.agents/skills/steward/SKILL.md`. Code findings the pass
   could not touch go in its body.

## The rubric, by pass

Each pass applies everything the passes before it did, plus its own cut.

Every pass fixes a comment that is **wrong**: one that names a module that
now exists as missing, a writer that is gone, a format or count the code does
not have. Correct it to what the code does, or cut the false sentence. That is
a comment edit, so it is in scope; never park it in the ledger or the pull
request for someone else, because the next reader meets the comment first.

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
- **Passes 3 to 7: consolidation.** Notes repeated across files move to
  the one module that owns the rule and the others drop them. Blocks that
  grew into essays are rewritten to their constraint.
- **Pass 8 and later: references.** Every comment that sends the reader to
  prose elsewhere (`product/…`, `.agents/…`, an `AGENTS.md`, `README.md` or
  `ARCHITECTURE.md`, a note's `§4.7`, an issue or pull request number) is
  rewritten to stand on its own: what this code does and why, in the
  comment's own words, or cut when the code already says it.
  `* WhatsApp number (\`product/design/channels/answering-on-telegram-and-whatsapp.md\`).`
  becomes `* WhatsApp number.`; `How one of a bot's subagents ended
  (\`25-bots.md\` §4.7, \`delegate\`): it answered, …` becomes `How one of a
  bot's subagents ended: it answered, …`. A pointer to code (`see
  \`HostPresence\``) is not prose and may stay when the code here needs it:
  the editor follows it and a rename breaks it loudly. A pointer to prose
  survives only for an external spec the code implements (an RFC, a vendor's
  documented quirk). TODOs keep their issue number. A label that numbers a
  note's items (`Q7.`, `the note's Q7 and Q8`) is the same pointer without the
  file name: cut it with the pointer, and grep the area for `the note` and
  such labels once the pointers are gone. Find the candidates with:

  ```bash
  git grep -nE '^\s*(//|#|\*|/\*\*?).*(product/|\.agents/|[A-Za-z0-9_-]+\.md\b|§)' -- <paths>
  ```

## Never cut

A comment that is the only place a reader learns a unit, a magic number's
meaning, an ordering or locking rule, a security reason, a platform quirk, or a
regression a test guards; when that fact sits behind a pointer, a pass moves
the fact into the comment and drops the pointer. Directives
(`biome-ignore`, `@ts-expect-error`, `//go:`, `//nolint`,
`oppenheimer:begin/end`), Go doc comments on exported identifiers, TODOs,
license headers, generated files, and the eval fixtures under
`scripts/evals/*/cases/` whose comments are part of the case. An eval planter
anchors on code, never on a comment, so a pass cannot silently break it.
