# Agentic UI eval

Do agents use the chat's agentic UI the way its tools teach them?

Since 2026-11-24 an agent can do three things on a card in the chat:

- draw a visual: `show_visual` for a bot, `runner sessions show` or the runner's MCP `show_visual` for a session's agent;
- ask for several values on a form (`ask_form`);
- ask a choice (`ask_user`).

Each is worth it only at the right moment:

- a visual when figures are compared, a trend is followed or progress is shown, unasked;
- words for one number, and never with made-up data;
- a Markdown table when the person asks for a table;
- a form for several typed values, a question card for one choice.

There are two lanes, with the same marks.

## Bots (`bots.ts`, `cases.json`)

The bot's real system prompt, the production `show_visual`, `ask_form` and `ask_user` (descriptions, checks and refusals; the cards' stores are stand-ins), and the production session tools over the in-memory workspace (`../bot-workspace.ts`).

| Case | A right run |
| --- | --- |
| `deploys-trend` | a chart of two weeks of deploys |
| `service-latency` | a visual of six services' p95, this week against last |
| `release-progress` | a checklist or progress of the release the person describes |
| `one-number` | words |
| `table-asked` | a Markdown table, no visual |
| `no-data` | no figures: no tool reads error rates |
| `signed-change` | a visual that holds values under zero (charts refuse them; it must recover) |
| `capacity-calculator` | an `html` block, the only one that takes input |
| `release-details` | `ask_form` |
| `one-choice` | `ask_user`, not a form |

## Session agents (`sessions.ts`, `sessions.json`)

Claude Code runs each task in a scratch checkout, the way a session launches it:

- **Its own system prompt.**
- **The runner's MCP server.** Its instructions and the descriptions of `show_visual`, `send_file` and `notify` are read off `apps/runner/internal/cli/mcp.go`, so the eval follows any change to them.
- **A `runner` on its PATH.** It answers `--skill` with `skill.md` and checks `sessions show` against the shared schema.

Both ways in are scored.

| Case | A right run |
| --- | --- |
| `bundle-compare` | a visual of five routes' sizes, main against the branch |
| `coverage-trend` | a visual of eight weeks of coverage |
| `read-code` | words |
| `table-asked` | a Markdown table, no visual |
| `fix-bug` | the fix, no visual |

## Marks

- `V` (bots), `M` or `C` (sessions, by MCP or by command): showed a fitting visual.
- `v`: showed one with none of the case's block types.
- `e`: every visual it sent was refused.
- `-`: showed none, or asked nothing, when it should have.
- `x`: showed one it should not have.
- `a`: asked when words were the answer.
- `i`: drew figures it could not have read.
- `F` / `Q`: asked on a form or on a question card.
- `f` / `q`: asked on the other kind.
- `.`: rightly did neither.
- `!`: the run failed or hit its turn cap. It is never right, so a broken login cannot pass the cases where doing nothing is right.

Besides right or wrong, every run reports two things:

- whether its first visual parsed (a refusal costs a turn);
- whether its answer repeated three or more of the visual's figures, which the tools ask it not to.

## Running it

```bash
pnpm turbo run build --filter='@oppenheimer/api^...'   # once: the API's packages
pnpm --filter @oppenheimer/shared build                # sessions: the runner shim reads its dist
pnpm eval:agentic-ui:bots                              # every case, 3 runs each
pnpm eval:agentic-ui:bots --case one-number --runs 5
pnpm eval:agentic-ui:sessions
```

- **Bot model:** `AGENTIC_UI_EVAL_MODEL`. It runs on the Messages API with `ANTHROPIC_API_KEY`, otherwise on the machine's Claude Code login.
- **Session model:** `AGENTIC_UI_SESSION_MODEL`, on the Claude Code login.
- **Both** default to `claude-sonnet-5-5`.

A lane passes when every case is right on a majority of its runs. Each run's calls and answer go to `reports/`.

## Results (2026-11-24, `claude-sonnet-5-5`, 3 runs per case)

| Lane | Before | After |
| --- | --- | --- |
| Bots | 21/30 runs; trend, comparison and progress 0/3 each | 28/30; every case passes |
| Sessions | 9/15; comparison and trend 0/3 each, the manual never read | 14/15; every case passes |

**Never shown unasked.** Before the fixes, neither kind of agent showed a visual unless the person named a chart. The tools were offered, and the bots' visuals all parsed when used, but every description said "use it only when". The bots' core prompt also said to write "Markdown when … a table helps", so both kinds of agent wrote a table of figures.

**What fixed it:**

- The descriptions now say to use a visual unasked, for figures compared, a trend or progress.
- The core prompt points figures at `show_visual`.
- The runner's MCP instructions name the kinds of figures, because a deferred MCP tool's description is not always read.

**Field mistakes.** Session agents also wrote `delta` as text and put `format` on items. The runner's compact description now says what each takes and where.

What still happens:

- **An empty first call.** Session agents send an empty `show_visual` call (`{}`) before the real one. It looks like Claude Code calling a deferred tool before loading its schema; the refusal costs one call.
- **The manual goes unread.** No session agent read `runner --skill` in any run: the MCP server's own text is what teaches them.
