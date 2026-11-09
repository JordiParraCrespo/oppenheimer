# Lessons from Codex, Grok Bot and OpenClaw: how one task runs for hours (2026-11-09)

The owner asked why a bot stopped mid-work at "20 steps" and whether a task
could run for 200 hours. We read three agents that run long tasks, to find
out how each bounds one: Codex's open source, a static read of Grok Bot's
newest Linux build, and OpenClaw's open source. Ideas only; no code is taken.
What `versions/mvp/25-bots.md` built from it is §2 ("A turn is bounded")
and §4.1 ("Goals"), dated 2026-11-09.

Sources:

- **Codex**: `openai/codex`, shallow clone of `main` on 2026-11-09, the Rust
  in `codex-rs` (`core/src/session/turn.rs`, `core/src/compact*.rs`,
  `ext/goal/`, `core/src/rollout_budget.rs`, `app-server/`).
- **Grok Bot 0.79.3**: the Linux `.deb` from Cursor's apt repository
  (`downloads.cursor.com/aptrepo`, suite `grok-bot`, sha256 `eee0d637…7168d`),
  unpacked from its `app.asar` and not run. The loop runs on the vendor's
  servers, so this is what the client's protobuf schemas, its flag catalog
  with fallback values, its error catalog and its copy show. `lessons-from-grok-bot.md`
  §9 read 0.78.1 for the harness as a whole.
- **OpenClaw**: `openclaw/openclaw` at `1d203729e` (2026-11-09). Its loop is
  the Pi agent runtime, vendored as `packages/agent-core`.

## 1. None of them caps a turn by steps or time

| | Codex | Grok Bot | OpenClaw |
| --- | --- | --- | --- |
| Model round trips in a turn | no limit (`run_turn` is a bare `loop {}`) | none in the agent schemas; a step cap only on computer-use episodes (`endedBy: turn_limit`) | no limit (`runLoop`'s `while (true)`) |
| Time on a turn | none; 10 s per command, 300 s on an idle stream | none; the model stream fails after 150 s with no first token, 90 s idle | 48 h by default, `0` for none, per model attempt |
| What ends a turn | the model answers with no tool call | the same (inferred) | the same, or a final message sent to the chat |

Codex says why it is safe in a comment at the top of its loop: "as long as
compaction works well in getting us way below the token limit, we
shouldn't worry about being in an infinite loop." The bound on a turn is
its context, and compaction keeps the context small.

## 2. Compaction, mid-turn, is what makes that safe

| | Codex | Grok Bot | OpenClaw |
| --- | --- | --- | --- |
| When | past `min(configured, 90% of the window)`, after each model call that will be followed by another | a background summary started at 70% (±5) of the window | before every model call, past `min(window − reserve, 75% of the window)` |
| How | a remote compaction call, or a local "handoff summary for another LLM that will resume the task" | `ConversationSummary` cut at a message id, chained to the previous summary | an LLM summary under fixed headings, updating the previous one |
| What is kept | the newest user messages, up to 20,000 tokens (64,000 remote) | from the cut on | the newest 20,000 tokens, and the last 3 turns word for word in its safe mode |
| Before it | nothing | nothing found | an agentic turn that saves lasting memories ("Pre-compaction memory flush") |

OpenClaw's summary headings are the model for ours: Goal; Constraints and
preferences; Progress (done, in progress, blocked); Key decisions; Next
steps; Critical context. A fold updates the last summary rather than
writing a new one, so nothing it held is dropped.

## 3. Goals: no limit of continuations, and the agent says when it is done

- **Codex** (`ext/goal`): when the thread goes idle and a goal is active, it
  starts the next turn itself (`turn_trigger: "goal"`). The agent ends it
  with `update_goal(complete | blocked | paused)`; there is no reviewer. Its
  continuation prompt asks for a completion audit before `complete`, and
  allows `blocked` only after the same blocker three turns running. There is
  no limit of continuations and no time limit.
- **Grok Bot**: `CreateGoal`/`UpdateGoal` with `ACTIVE | PAUSED | COMPLETE |
  CLEARED`, a `GOAL_CONTINUATION` synthetic turn, on by default. No count,
  budget or reviewer is visible in the client.
- **OpenClaw** has no goal object: work goes on past a turn only through
  follow-ups (a background command exiting, a subagent settling, cron, a
  restart).

## 4. What stops one that goes wrong

| | Codex | Grok Bot | OpenClaw |
| --- | --- | --- | --- |
| No progress | 3 automatic goal turns in a row with no activity: the goal is `blocked` | loop detection, **off** by default (`grok_bot_loop_detection`) | tool-loop detection (same input and same result, repeated; ping-pong; 30 calls), **off** by default |
| Always on | an optional token budget per goal: `budget_limited`, told to wrap up | a spend guard that pauses routines nobody reads; a conversation size cap | 3 identical tool failures in a row stop that action; repeated model output; a post-compaction loop check |
| Spend | an optional token budget shared by a session tree (off by default) | usage limits fail the turn | none |

## 5. Usage limits, restarts

- **A usage limit stops the work; nobody resumes it on their own.** Codex
  marks the goal `usage_limited` and the person resumes it; Grok Bot fails
  the turn ("Weekly usage limit reached"); OpenClaw sleeps up to its run's
  time limit, then fails and asks the person to send again.
- **A restart is one new turn that says so.** Codex: "The server restarted
  and interrupted the previous turn. Continue the unfinished work…";
  OpenClaw: "The Gateway restarted while you were working… check the
  current state of anything that was in progress before repeating it."

## 6. What we took (25 §2 and §4.1, 2026-11-09)

| Theirs | Ours |
| --- | --- |
| No step or time limit on a turn | Gone: the 20 round trips and the 4 minutes. A run with a narrow job (a subagent, a completion) still passes one |
| Mid-turn compaction | Ours for the OpenAI engines (the Agents SDK's `callModelInputFilter`), Claude Code's own for the Claude engine, both at 70% of `min(model window, 128,000)`, keeping the newest 20,000 tokens, under OpenClaw's headings and updating the last summary. A bot is a chat, so it compacts sooner than a coding agent, and every call stays quick and cheap |
| Idle stream deadline | A turn fails `stalled` when the engine says nothing for 5 minutes while none of its tools runs |
| OpenClaw's loop detection and its stop on repeated failures, on | Always on (`ToolLoopGuard`): the same call failing the same way 3 times is not run again; the same call answering the same thing warns at 5 and is refused at 10; 5 refusals end the turn as `loop` |
| Goals with no limit, the agent saying done | No limit of continuations. The bot says met or blocked with `end_goal`; our reviewer checks a met claim, which neither Codex nor Grok Bot has |
| Codex's empty turns, budget, `usage_limited`, resume | A goal pauses, keeping its place, on 3 turns in a row with no tool, a spent token budget, a provider limit, a failed or stopped turn, or the bot blocked; the owner resumes it (Resume, `/goal resume`) |
| The restart turn | A turn stopped without fault (stalled, a restarted worker) does not pause its goal: the next continuation is told its last turn stopped early and to check what it left in progress before repeating it |

Not taken yet: OpenClaw's memory flush before compaction (a bot saves as it
goes, `remember`, which covers most of it), resuming on its own when a usage
limit resets, and the per-session token budget.
