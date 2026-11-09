---
"@oppenheimer/backend-agents": minor
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A bot's work has no fixed length: a turn has no step or time limit, a goal
no limit of continuations, and what stops one that goes wrong is
compaction, a guard or a pause (`product/research/lessons-from-long-running-agents.md`).

- `@oppenheimer/backend-agents`: `maxSteps` absent means no limit (it was
  25). Every engine compacts mid-turn past `compactionThreshold` (70% of
  `min(contextWindow, 128,000)`): Claude Code through its own settings, the
  OpenAI engines through `TurnCompactor` on the Agents SDK's
  `callModelInputFilter`. New request fields `contextWindow` and
  `compaction`; a new `compacted` event. `ToolLoopGuard` runs in `runTool`
  on every turn: an identical call that failed 3 times in a row, or that
  answered the same thing 10 times, is refused, its data carrying
  `LOOP_GUARD_DATA_KEY`.
- `@oppenheimer/shared`: `BOT_TURN_IDLE_LIMIT_MS`; turn failures `stalled`
  and `loop`; `BOT_GOAL_PAUSE_REASONS`, `BOT_GOAL_IDLE_TURNS`,
  `BOT_GOAL_TOKEN_BUDGET_MIN`; goal activities `paused` and `resumed`;
  `BotGoal.limit` nullable, with `tokensUsed`, `tokenBudget` and `paused`;
  `/goal resume`. `BOT_GOAL_CONTINUATIONS_*` are gone.
- `@oppenheimer/api`: no `BOT_TURN_MAX_STEPS` or `BOT_TURN_TIME_LIMIT_MS`;
  a turn fails `stalled` after 5 minutes of a silent model while no tool
  runs, and `loop` after 5 refused calls. Goals have no limit, the reviewer
  checks the bot's `end_goal` claim only, and a goal pauses (blocked, a
  provider limit, 3 turns with no tool, a spent budget, a failed or stopped
  turn) instead of ending. `POST /v1/bots/:id/goal/resume`. Migration
  `UnboundBotGoalsAndTurns`.
- `@oppenheimer/api-client`: `resumeBotGoal`, `BotGoalPausedResponseDto`,
  and the goal's new fields.
- `@oppenheimer/frontend-consumer`: `useResumeBotGoal`.
- `@oppenheimer/web`: the goal banner says why a goal paused, with Resume;
  goal lines for `paused` and `resumed`; `/goal resume`.
- `@oppenheimer/translations`: failure copy for `stalled` and `loop`; the
  goal's pause reasons, Resume and its lines.
