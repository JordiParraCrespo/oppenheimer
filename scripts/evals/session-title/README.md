# Session title eval

Is a session's name short, and easy to tell apart from the sessions beside
it in the sidebar?

A session is named from its first prompt and, once the agent has answered
the second, once more from all of them (`sessionTitleRequest` and
`conversationTitleRequest` in
`apps/api/src/sessions/domain/session-name.policy.ts`). What the model is told
is `apps/api/src/sessions/domain/prompts/system/title.md`. A change to those
words, to the length asked for, or to `cleanModelTitle` is what this eval is
for.

## The cases

`cases.json` holds 24 sessions in six groups of four siblings from one
project, the way they sit together in the sidebar: the console's sidebar,
the runner, sign-in (in Spanish), billing, settings (in Catalan) and the
API's internals. Each has the person's prompts, the language they wrote in,
and what it is really about. Several open with a vague first prompt ("fix
the bug", "continue", "revisa el PR 812") that only the second makes
clear, and one opens with an instruction the namer must name rather than
carry out ("tradueix la pàgina de configuració al català").

The examples in `title.md` are on purpose from other domains, so the prompt
is not fitted to these cases.

## Running it

```bash
pnpm eval:session-title                 # every case, once
pnpm eval:session-title --runs 3        # each name asked for 3 times
pnpm eval:session-title --case login-totp
```

`SESSION_TITLE_EVAL_MODEL` is the namer (default `claude-haiku-5-5`, a small
fast model like the one `SESSION_NAMER_MODEL` names in production) and
`SESSION_TITLE_EVAL_GRADER` the grader (default `claude-sonnet-5-5`). With
`ANTHROPIC_API_KEY` it calls the Messages API; without it, the machine's
Claude Code login through the Agent SDK, which cannot set the temperature,
so use `--runs 3` before comparing two prompts.

## What it checks

- **fits**: the model's own answer is at most 40 characters, so the API
  never had to cut it. Words are reported, not checked: Spanish and Catalan
  spend more of them on short function words for the same width.
- **lean**: no filler opening ("Help with", "Question about") and not a bare
  generic title ("Bug fix", "Review").
- **specific**: the grader says it names the thing the work is about.
- **language**: the grader says it is in the language the person wrote in.
  It is strict about loanwords: "Login 2FA TOTP" for a Spanish session is
  failed, though that is how a Spanish developer would write it.
- **tellable**: the grader, seeing only this session's prompts, picks its
  name out of its group's four. Both prompts below score 100%, so the check
  is saturated: four siblings about different bugs are easy to tell apart.
  It guards against a regression, not a ranking.

## Results

Namer `claude-haiku-5-5`, grader `claude-sonnet-5-5`, Agent SDK, 3 runs:

| Prompt | Pass | fits | language | tellable | Words | Characters |
| --- | --- | --- | --- | --- | --- | --- |
| Before: "a title, at most 40 characters and 6 words" | 66/72 | 92% | 100% | 100% | 5.7 | 34.7 |
| After: the thing first, its distinguishing detail, no filler, 3–4 words, examples | 63/72 | 93% | 94% | 100% | 4.6 | 28.1 |

The new names are about a word and six characters shorter, start with the
thing ("Sidebar reorder snaps back", "Refresh token caduca rápido") rather
than a verb ("Fix sidebar project drag reorder", "Review PR 812: refresh
token expiry"), and stay as easy to tell apart. Of the new prompt's misses,
three are the grader's loanword call above, five are 42–45 characters long,
which the API cuts at a whole word, and one names a Spanish conversation
that opened with a pull request number in English.
