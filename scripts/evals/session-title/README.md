# Session title eval

Is a session's name short, and does it tell the session apart from the ones
beside it on the same part of the product?

A session is named from its first prompt and, once the agent has answered
the second, once more from all of them (`sessionTitleRequest` and
`conversationTitleRequest` in
`apps/api/src/sessions/domain/session-name.policy.ts`). What the model is told
is `apps/api/src/sessions/domain/prompts/system/title.md`. A change to those
words, to the length asked for, or to `cleanModelTitle` is what this eval is
for.

## The cases

`cases.json` holds 24 sessions in six groups of four. The sessions in a
group are on the **same** component and differ only in one detail, the way
they sit together in the sidebar: the runner's self-update (macOS signature,
Debian old binary, download loop, rollback), dragging in the sidebar, the
invoice email, sign-in (in Spanish), session search (in Catalan) and settings
(in French). Each case has:

- `prompts`: what the person typed. Several open with something vague
  ("continue", "arregla el bug") or with a pull request to look at ("revisa
  el PR 812"). One is an instruction the namer must name rather than carry
  out ("tradueix els textos de la cerca de sessions al català").
- `about`: what the session is about, in English.
- `detail`: the least that sets the case apart from its three siblings ("Safari", "macOS, or the
  invalid signature"). It is not everything the case is about: a name with
  "macOS" in it is already the only macOS one in its group.

The examples in `title.md` are from other domains and in German and
Portuguese, which no case uses, so the prompt is not fitted to these cases.

## Running it

```bash
pnpm eval:session-title                          # every case, 3 runs
pnpm eval:session-title --against f9b018c8       # and the prompt at that commit, on the same jobs
pnpm eval:session-title --case login-google-safari --runs 5
```

`--against <git ref>` loads the policy and prompts as they were at that
commit (into the ignored `.against/`) and scores both on the same cases,
runs, grader and transport. It then compares them case by case: a case is
better when it passed on more of its runs, and a sign test says how likely
the split is by chance. Every report records the commit and a digest of each
prompt it scored.

`SESSION_TITLE_EVAL_MODEL` is the namer (default `claude-haiku-5-5`) and
`SESSION_TITLE_EVAL_GRADER` the grader (default `claude-sonnet-5-5`). With
`ANTHROPIC_API_KEY` it calls the Messages API at the production temperature
(0). Without it, it uses the machine's Claude Code login through the Agent
SDK, which takes neither a temperature nor a token budget, so the same
prompt can give a different name on each run: compare over runs.

Production names sessions with whatever OpenAI-compatible model
`SESSION_NAMER_MODEL` points at, often a small open-weights one. This eval
has only been run with Haiku; a run against that model is still owed.

## What it checks

A name passes when every check does. A case passes on a majority of its
runs, and the eval exits 1 when one does not.

- **fits**: the model's answer, without the prefixes the API strips, is at
  most 40 characters, so the row's hard cut was not needed.
- **short**: at most 5 words and 32 characters, what the prompt asks for.
- **lean**: no filler word anywhere (fix, add, review, investigate, … and
  their Spanish, Catalan and French forms) and no pull request or ticket
  number.
- **detail**: the grader says the name carries the case's `detail`.
- **language**: the grader says the name is in the person's language,
  judged by its own words. Technical loanwords (login, token, 2FA, upload) do
  not count against it; a name wholly in another language does.
- **tellable**: the grader reads only `about` (not the person's words, so it
  cannot match them), then picks the session's name out of its group's four.

`tellable` is still nearly saturated: once a name carries the component and
anything at all of the case, three siblings are easy to rule out. A name
that drops the distinguishing detail ("Sidebar project drag reorder" for the
one that snaps back) is still picked by elimination. `detail` is the check
that catches it.

## Results

Namer `claude-haiku-5-5` and grader `claude-sonnet-5-5`, through the Agent
SDK, 3 runs each, both prompts on the same jobs:

| Prompt | Pass | fits | short | lean | detail | language | tellable | Words | Characters |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `f9b018c8`: a title of at most 40 characters and 6 words | 4/72 | 90% | 8% | 61% | 97% | 99% | 100% | 5.7 | 35.9 |
| This one: the thing, then the detail, no filler, 3–4 words | 39/72 | 96% | 64% | 96% | 96% | 94% | 100% | 4.8 | 29.7 |

Case by case, the new prompt is better on 18, worse on none and the same on
6 (sign test p ≈ 0.00001). Most of the old prompt's misses are length and
filler ("Fix…", "Corriger…", "Ajouter…"), which it was never asked to avoid,
so this measures the new rules being followed more than names becoming more
distinct. Both prompts already carry the distinguishing detail about as
often.

The new prompt's misses:

- **short**: about a third of names run past 32 characters or 5 words. The
  model follows the examples' length better than the number.
- **language**: the French avatar session, which says "upload", is named in
  English in every run ("Avatar upload fails over 2 MB").
- **lean**: "Invoice email template review" keeps "review" in every run.
- **detail**: "Sidebar project drag reorder" drops "snaps back".
