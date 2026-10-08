# Routine: daily Domain-Driven Hexagon audit of `apps/api`, every module

You are auditing the NestJS API in this repository against its own
Domain-Driven Hexagon contract. You are a **reviewer first**: steps 1–6 are
read-only, and their output is the report. Only step 7 writes code, only for
the findings it admits, and only on its own branch.

The contract is defined by the repository, not by you. The sources, in order of
authority:

1. `apps/api/ARCHITECTURE.md`
2. `.agents/rules/nestjs-architecture.md`, `.agents/rules/nestjs-di.md`,
   `.agents/rules/typeorm.md`
3. `apps/api/AGENTS.md`

Read all of them before reviewing any code. A finding must cite one of them. If
you cannot quote the sentence a piece of code breaks, it is not a finding —
general DDD opinions, the upstream Sairyss repository, and "I would have done it
differently" do not count.

## Arguments

The prompt may end with arguments. Defaults are for the scheduled run.

- `--since <git-ref-or-date>`: base for the ledger diff (step 3) and for
  telling a new finding from one already open. Default: `26 hours ago` on the
  default branch (two hours of overlap, so a late run never leaves a gap).
- `--module <name>`: review only this module instead of all of them (step 4).
  For evals and one-off checks; the scheduled run never passes it.
- `--dry-run <path>`: write the report to `<path>` as Markdown and do not touch
  GitHub at all.

## 1. Prepare

```bash
git fetch origin main && git checkout --detach origin/main   # skip under --dry-run: audit the checkout as it is
pnpm install --frozen-lockfile
```

## 2. Mechanical checks

Run these and keep their full output:

```bash
node scripts/check-api-structure.mjs
pnpm turbo run arch --filter=@oppenheimer/api
pnpm --filter @oppenheimer/api exec vitest run src/__tests__/error-catalog-coverage.spec.ts src/__tests__/route-policy-coverage.spec.ts
```

**Always run `arch` through `turbo`.** Plain `pnpm --filter @oppenheimer/api
arch` on a fresh checkout reports dozens of `domain-stays-pure … →
@oppenheimer/backend-ddd` errors, because the workspace packages have no
`dist/` yet and dependency-cruiser cannot resolve them. Those are false. If you
see that pattern, you ran it the wrong way; do not report it.

Any failure here is a **blocking** finding. Report it verbatim (trimmed to the
violating lines); do not re-derive it by reading code.

## 3. Ledger drift

Known violations are ledgered in two places:

- `LEDGER` in `scripts/check-api-structure.mjs`
- every `pathNot` list in `apps/api/.dependency-cruiser.cjs` that names a
  specific file (the file itself says these are ledger entries, not exemptions)

Diff both against the `--since` base (`git diff <base> -- <file>`, or
`git log --since=… -p -- <file>` for a date). An **added** entry is a blocking
finding, because it silences a rule. Name the commit and author that added it. A
**removed** entry is good news; list it under "Paid down".

Count the ledgers with these exact commands, never by eye, so the number is
comparable from one day to the next:

```bash
grep -cE "path: 'apps/api/src/" scripts/check-api-structure.mjs              # structure (0 on 2026-10-08)
grep -oE "'\^src/[^']*\\\\\.ts\\$'" apps/api/.dependency-cruiser.cjs | wc -l  # dependency (17 on 2026-10-08)
```

Nothing already on a ledger is a new finding. Do not report ledgered files again
unless the code under the entry got worse, for example a new route added to a
controller that is already ledgered as `route-outside-slice`.

## 4. Scope of the judgment review

**Every module, on every run.** The point of the routine is that the whole API
follows the contract, not only the code that changed today, so the review
covers:

- every directory under `apps/api/src/` that contains a `*.module.ts`, in full;
- `packages/backend/ddd/src/**`, the building blocks those modules extend.

Skip `*.spec.ts`, `migrations/` and generated files. `--module <name>` narrows
the review to that one module.

List the modules and their size, so the split is by lines and not by count:

```bash
cd apps/api/src && for d in $(ls -d */ | sed 's#/##' | sort); do
  ls "$d"/*.module.ts >/dev/null 2>&1 &&
    echo "$d $(find "$d" -name '*.ts' ! -name '*.spec.ts' ! -path '*migrations*' | xargs cat | wc -l)"
done
```

**Fan out.** The API is too large to read file by file in one context. Split
the modules into at most six groups of roughly equal line count (give
`packages/backend/ddd` to the smallest group) and hand each group to a
subagent, all in parallel. Each subagent's brief is the same:

- the group's directories, and that it is read-only: no edits, no checkout;
- read the four contract sources above, then steps 3 and 5, "Verify before
  reporting" and the severities in step 6 of this file, and skim
  `apps/api/src/users/`, the reference module;
- check every file in the group against the step 5 rows for its layer, and
  verify each candidate as step 5 says;
- return candidates only, each with its key, severity, fingerprint,
  `path:line` for every occurrence, the offending lines verbatim (≤8), the
  rule sentence quoted with its source, a one-sentence fix, and whether the
  fix is local and leaves the HTTP contract alone; then "worth a look" items;
  then any pattern it suspects repeats in other modules.

**A subagent's finding is a candidate, not a finding.** When they are all back,
you run "Verify before reporting" again on every candidate yourself: open the
file at the cited line and quote the rule. Then merge across groups: the same
pattern from two groups is one row, and a pattern a subagent flagged as
possibly repeated is `grep`ped across all of `apps/api/src` before you decide
between a single finding and **systemic** (step 6).

Name each finding **new** when its fingerprint is not in the issue's current
body (step 6), and **open** when it is. Files changed since the base (`git diff
--name-only <base>...HEAD`) are where new findings usually come from; say in
the report when a new one is in old code, because that means an earlier run
missed it.

## 5. Judgment checklist

These are the rules that the scripts in step 2 **cannot** see. Check each file
in scope against the rows that apply to its layer. Each row has a stable key
that the report uses for fingerprinting.

| Key | Applies to | Rule (and where it is written) |
| --- | --- | --- |
| `HEX-CMD-RETURN` | `*.command-handler.ts` | A command handler returns only the aggregate id, or nothing. It never returns an entity, a DTO or a read model. To show the result, the controller dispatches a follow-up query. Per-request data that no query could read back may ride beside the id, like sessions' `{ sessionId, hints }`; the entity itself may not. (nestjs-architecture.md, "CQRS") |
| `HEX-QUERY-WRITE` | `*.query-handler.ts` | Queries are read-only: no `save`/`insert`/`update`/`delete`, no dispatching commands, and no raising events. (nestjs-architecture.md, "CQRS") |
| `HEX-THIN-CONTROLLER` | `*.http.controller.ts` | A controller only builds a command or query, dispatches it on the bus and maps the result. Any of these is a finding: branching on domain state, computing or deciding values, loops over domain data, calling an injected service other than `CommandBus`, `QueryBus` or a mapper, or catching and translating domain errors. (ARCHITECTURE.md, "Controller") |
| `HEX-MAPPER-OWNS-SHAPE` | handlers, `application/`, controllers | Field-by-field translation between representations belongs in the module's mapper. A handler or controller that hand-assembles an object literal of three or more fields copied from another shape is a finding. So is an `as unknown as` or repeated `as Record<…>` cast outside a mapper or `*.util.ts`. (nestjs-architecture.md, "Mapper"; apps/api/AGENTS.md) |
| `HEX-ENCAPSULATION` | everything outside `domain/` | Aggregate state changes only through the entity's own methods. Writing to `entity.props.*`, to the result of `getProps()`, or to a public field of an aggregate from a handler, mapper (other than `toDomain` construction) or repository is a finding. (ARCHITECTURE.md, "Domain entity") |
| `HEX-ALWAYS-VALID` | `domain/*.entity.ts`, `value-objects/` | Invariants live in `validate()` or the value-object constructor, and a method that changes state keeps the entity valid, either by calling `validate()` or by guarding itself. Watch for a subclass that redeclares `_id` or another base field, which is explicitly forbidden. (ARCHITECTURE.md, "Domain entity") |
| `HEX-EVENTS` | `domain/`, `database/*.repository.ts` | The aggregate raises domain events with `addEvent(...)`, passing a human-readable `reason`. The repository stages them on the outbox (`OutboxService.stageEvents`) **inside the same transaction** as the write. Emitting on `EventEmitter2` directly from a handler or repository, or staging events outside the transaction, is a finding. (nestjs-architecture.md, "Event-driven async processing") |
| `HEX-PORT-OPTION` | `*.repository.port.ts`, `*.port.ts` | Single-row lookups on a repository port return `Option<T>` from `oxide.ts`, not `T \| null` or `T \| undefined`. (nestjs-architecture.md, "Repository ports") |
| `HEX-PORT-INJECTION` | handlers, `application/` | A port is injected through its `Symbol` DI token, typed as the port interface. Never inject the concrete class, and never type the parameter as the adapter even when the token is correct. (nestjs-di.md) |
| `HEX-ERRORS` | handlers, controllers, guards, `application/`, adapters | Anything that can reach an HTTP response throws `AppError` with a catalog entry. Each of these is a finding: throwing a bare `HttpException`, `ForbiddenException`, `NotFoundException` or other Nest exception; a guard that `return false`s instead of throwing; spreading a catalog entry to interpolate request data into `message` (that goes in `detail`); passing an upstream error through unmapped. A plain `Error` is allowed only on paths that never answer HTTP (the outbox relay, queue processors). (nestjs-architecture.md, "Structured errors") |
| `HEX-USE-CASE-LEAK` | `application/`, `infrastructure/` | Code that is really a use case, meaning an operation a user triggers that loads an aggregate, changes it and saves it, hiding in `application/` or `infrastructure/` instead of a `commands/` slice. (ARCHITECTURE.md, rule 1 of "The module contract") |

Out of scope, because other tools own them: formatting and lint (Biome), file
placement and naming (step 2), import boundaries (step 2), Swagger completeness,
test coverage and performance. Do not report them.

### Verify before reporting

For every candidate finding, re-open the file and confirm all four of these:

1. The **exact line** exists at the path and line number you cite.
2. You can quote the **rule sentence** from the source document it breaks.
3. It is **not ledgered** (step 3) and not already reported by step 2.
4. It is **not an explicit, commented exception** in the code or rules. For
   example, `complete-sign-up.command-handler.ts` dispatching other modules'
   commands is documented in `.dependency-cruiser.cjs`.

Drop anything that fails a check. Precision matters more than recall: a report
that cries wolf gets muted. If you are unsure, list the item under "Worth a
look" with one line on why, never under "Findings". Something you verified as
allowed goes nowhere: not in "Worth a look", and not as a "not a finding" note.

**One pattern, one row.** When the same violation repeats across several files
(the same call, the same shape, the same shortcut), report it as a single
finding. Fingerprint it on the first occurrence and list every occurrence in
the Evidence. Four controllers that each call the same port are one finding,
not four.

**When the rule and the reference disagree.** If `users/` (the module
ARCHITECTURE.md tells you to copy) does the thing a rule forbids, do not report
it anywhere else either. Put one line under "Worth a look" that names the rule
and the reference file, because one of them has to move.

## 6. Report

Rate each finding:

- **blocking** when code breaks a stated rule in a way that changes behaviour or
  the contract: a command returning a read model, a query that writes, a bare
  Nest exception, an event that bypasses the outbox, a domain import, a ledger
  addition, or a new legacy-shape route.
- **drift** when it breaks the letter of a rule without changing behaviour, or
  is on the way to breaking one. Examples: a shape assembled outside the mapper,
  or a controller at 100 of its 110 lines that has started to branch.
- **systemic**: when the same pattern appears in three or more modules
  (`grep` for it before you report), it is the codebase's de-facto convention,
  not one file's lapse. Report it **once**, as drift, name every occurrence in
  the Evidence, and note that the rule and the code disagree. Someone has to
  pick one of them, and that is not a fix PR's call.

Give each finding a fingerprint: `<KEY>:<path>:<symbol>`, where the symbol is
the class or method name, never the line number, so the fingerprint survives
edits.

Use this Markdown:

```markdown
## Hexagon audit — <YYYY-MM-DD> (base <ref>, <n> modules reviewed)

**Mechanical:** structure ✅/❌ · boundaries ✅/❌ · error catalog ✅/❌ · route policies ✅/❌
**Ledger:** <n> structure + <m> dependency entries (<+added / −removed> since base)

### Findings
| Sev | Key | Where | What | Fix |
| --- | --- | --- | --- | --- |
| blocking | HEX-CMD-RETURN | [`path:line`](permalink) | one sentence, quoting the code | one sentence |

<details><summary>Evidence</summary>
For each finding: the offending lines (≤8) and the rule sentence it breaks, with its source.
</details>

### Worth a look
### Paid down
```

Build permalinks with the commit SHA you audited:
`https://github.com/<owner>/<repo>/blob/<sha>/<path>#L<line>`.

**Under `--dry-run <path>`:** write the report to that path and stop.

**Otherwise, publish to GitHub** with the GitHub tools, in the repository this
checkout came from (`git remote get-url origin`):

1. Find the open issue labelled `hexagon-audit`. If there is none, create it
   with the title `Hexagon audit: open findings`, creating the label first if it
   is missing.
2. The issue **body** is the current state: the table of every open finding,
   keyed by fingerprint. Rewrite it on each run from the full sweep. A
   finding in the previous body that the sweep did not return is fixed only
   when you open its file and the violation is gone; if it is still there,
   the sweep missed it, so carry it over and keep it.
3. Add a **comment** only when something changed: a new finding, a fixed one, a
   ledger change, or a red mechanical check. The comment is the dated report
   above, restricted to what changed. On a quiet day with everything green and
   nothing new, post nothing.
4. Never @-mention anyone, never assign, and never label anything other than
   this one issue and the pull request from step 7.

## 7. Fix pull request (blocking findings only)

Skip this step under `--dry-run`, and when there are no blocking findings.

**What may be fixed.** A blocking finding qualifies only if all of these hold:

- The fix is local: at most 3 files and about 60 changed lines per finding.
- It does not change the HTTP contract, meaning response shapes, status codes,
  routes and error codes. The one exception is replacing a bare Nest exception
  with the matching catalog `AppError`, when the catalog already has the entry.
- It is not a mechanical failure whose cause is outside `apps/api/src`, such as
  a broken build or a dependency bump.
- It is not a ledger addition. Say in the issue that someone has to decide
  whether it stays; never revert another person's ledger entry yourself.
- It is not systemic and not a single-pattern finding with several occurrences,
  such as a shared result type that every handler in a module returns. Those
  are design decisions for a person, even when each fix would be small.

Everything else stays in the issue only. When in doubt, leave it out.

**How.**

1. If an open PR labelled `hexagon-audit` already exists, do not open a second
   one. Mention in the issue comment that the previous one is still waiting,
   and stop.
2. Branch from the audited commit: `hexagon-audit/<YYYY-MM-DD>`.
3. Fix each admitted finding the way the rule and the reference module
   (`users/`) do it. Add or adjust the unit test beside the changed handler
   when one exists. Never delete, skip or weaken a test, and never touch
   `LEDGER`, `.dependency-cruiser.cjs`, `ARCHITECTURE.md` or `.agents/rules/`.
4. Prove it before pushing. All of these must pass:
   ```bash
   pnpm --filter @oppenheimer/api lint                 # Biome
   node scripts/check-api-structure.mjs
   pnpm turbo run arch build --filter=@oppenheimer/api # build = typecheck
   pnpm --filter @oppenheimer/api test
   ```
   If a check fails and one more attempt does not fix it, drop that finding
   from the PR, restore its files, and say so in the issue.
5. Commit with a conventional commit, one per finding:
   `fix(api): <what> (<KEY>)`. Push the branch.
6. Open the PR against the default branch, ready for review, labelled
   `hexagon-audit`, titled `fix(api): hexagon audit <YYYY-MM-DD>`. The body
   lists each finding fixed (fingerprint, rule quote, what changed) and links
   the tracking issue. Follow the repository's PR template if it has one.
7. Link the PR from that day's issue comment.

End the session with a one-line summary, for example:
`hexagon audit 2026-09-26: 27 modules, 2 new, 1 fixed, 5 open, mechanical green, PR #123 (1 fix)`.
