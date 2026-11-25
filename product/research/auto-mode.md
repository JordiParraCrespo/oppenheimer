# Auto mode: how Claude Code and Codex let an agent act without asking

Read on 2026-11-25 for the bots' approval levels (`versions/mvp/25-bots.md`
§5). It covers what Anthropic says about how it built Claude Code's auto
mode, and how OpenAI's open-source Codex CLI decides on its own whether a
call may run (commit `ebd0765` of `openai/codex`, `codex-rs/`). Both
products have a third level beside auto: a flag that turns every check off.

## 1. Claude Code's auto mode

Sources:

- [E] "How we built Claude Code auto mode", 2026-03-25:
  <https://www.anthropic.com/engineering/claude-code-auto-mode>
- [D] the permission-modes docs:
  <https://code.claude.com/docs/en/permission-modes>
- [B] "Auto mode is now the default in Claude Code", 2026-08-07:
  <https://claude.com/blog/auto-mode-default-in-claude-code>

**Three tiers [E][D].**

1. A fixed allowlist: reads, search, code navigation, todos, and the
   user's own allow rules.
2. Edits inside the project.
3. Everything else goes to a transcript classifier.

**The classifier is reasoning-blind.**

- It runs on Sonnet 4.6 at launch [E], and on Sonnet 5 now (overridable,
  [D]).
- It sees the user's messages, the tool calls and the project's
  `CLAUDE.md` [D].
- It never sees the agent's own prose or any tool result [E]: "hostile
  content in a file or web page can't manipulate the classifier directly"
  [D].
- A second layer on the server scans tool results for injection and warns
  the agent [E].

**Two stages [E].** A single-token filter told to "err on the side of
blocking" runs first. Only what it flags gets a reasoning pass.

**Defaults.** By default it trusts only the current repository and its
remotes. It has more than twenty block rules in four groups: destroy or
exfiltrate, weaken security, cross trust boundaries, and bypass review or
affect others. Examples [D]:

- `curl | bash`
- sending secrets out
- production deploys
- force pushes
- merging a pull request no human approved
- granting access

Users widen it with `autoMode.environment` and `autoMode.allow`. Ask and
deny rules still hold under it. A permission given in the conversation
counts only when it names the action.

**On a block.** The agent is told as a tool result to find a safer way,
not to route around it [E]. After three blocks in a row, or twenty in all,
it falls back to prompting the user [D]. A failed classifier blocks the
call [D].

**Numbers [E].**

| Measure | Rate |
| --- | --- |
| False positives, 10,000 real actions | 0.4% |
| False negatives, 52 real overeager actions | 17% |
| False negatives, 1,000 synthetic exfiltrations | 5.7% |

Most of the misses were the classifier seeing the danger but misjudging
whether the user's consent reached that far. Users approved 93% [E] to 97%
[B] of manual prompts. That approval rate is the argument for the mode:
prompts people click through protect little.

**Skipping permissions.** `--dangerously-skip-permissions`
(`bypassPermissions`) turns off every prompt. It is for "isolated
containers and VMs only" and "offers no protection against prompt
injection" [D]. Auto mode is the middle ground between it and asking
every time [E].

## 2. Codex

**Two policies, crossed.**

- Approval policy (`protocol/src/protocol.rs`): `untrusted`, `on-request`
  (the default), `granular`, `never`.
- Sandbox (`protocol/src/config_types.rs`): `read-only`, `workspace-write`,
  `danger-full-access`.

**Two flags** (`utils/cli/src/shared_options.rs`):

- `--approve-for-me` (alias `--not-so-yolo`) routes approvals to a model
  reviewer, "Guardian".
- `--dangerously-bypass-approvals-and-sandbox` (alias `--yolo`) is
  `never` plus full access.

**The reviewer** (`ext/guardian-reviewer`, `prompts/templates/guardian/`):

- **Trust.** It trusts only user and developer messages and `AGENTS.md`.
  Everything else in the transcript is "untrusted evidence". Text cut short
  is not assumed harmless.
- **What it sees.** The transcript (with tool output, unlike Claude Code's),
  the retry reason and the planned action as JSON. Reasoning is excluded.
- **Its answer.** It rates `risk_level` (low, medium, high, critical) and
  `user_authorization` (unknown, low, medium, high) and answers
  `{"outcome": "allow"|"deny", "rationale"}`.
- **Threshold:**
  - low and medium are allowed;
  - high only at medium authorization or more, and narrowly scoped;
  - critical is always denied.
- **Failures.** It has 90 s and three attempts, and fails closed: "This is
  a review failure, not a determination that the action is unsafe. Do not
  bypass the approval check". A denial tells the agent not to work around
  it.
- **Circuit breaker.** Three denials in a row, or ten in fifty, ends the
  turn.

**Static rules.** Starlark `prefix_rule`s (`execpolicy`) decide allow,
prompt or forbidden before any model is asked. A user's "always allow" is
written back as a rule, but never for a bare interpreter (`bash -lc`,
`git`, `env`). A heuristic flags forced `rm`.

## 3. What the bots took (2026-11-25)

The bots' three levels are the sessions' own: Ask for approval, Approve for
me, Full access. Approve for me is a reviewer, `bot-auto-review.policy.ts`
with its prompt in `core/job-auto-review.md`.

| Taken | From |
| --- | --- |
| The reviewer reads only the owner's words (their console messages, the bot's instructions) and the call, never the bot's text or tool results | Claude Code (Codex shows tool output; we do not) |
| Risk × authorization, a fixed threshold, critical never | Codex, the threshold held in code as well as in the prompt |
| Fail closed: an unreadable or failed review asks | both |
| The owner's own Ask and ask rules go past the reviewer | Claude Code's `permissions.ask` in auto mode |
| One cheap call per action on the bot's own model, no tools | ours: the rule review already worked this way |

| Not taken | Why |
| --- | --- |
| Two stages | One call per asking call is cheap at the bots' rate. Add a fast first pass if `/usage` says otherwise. |
| A refusal counter | A refusal here is a card, which ends the turn, so the bot cannot loop on refusals. |
| A trusted-environment setting | The owner's rules already say it in words. |

Full access is the bots' `--dangerously-skip-permissions`: no card, the
calls that always asked or escalated included. It keeps the owner's own
Ask, their ask rules, and sending mail, which runs only from its card.
