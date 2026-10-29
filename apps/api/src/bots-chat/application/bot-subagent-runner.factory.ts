import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { BotEngine, BotEngineTool, BotTurnRequest } from '@oppenheimer/backend-agents';
import type { BotSubagentProgress, BotSubagentRun } from '@oppenheimer/shared';
import { toQueuedSubagentProgress } from '../bot-message.mapper';
import { BOT_ENGINE, BOT_STREAM } from '../bots-chat.di-tokens';
import {
  composeSubagentPrompt,
  composeSubagentTask,
  SUBAGENT_CONCURRENCY,
  SUBAGENT_MAX_STEPS,
  SUBAGENT_RESULT_MAX,
  SUBAGENT_TIME_LIMIT_MS,
  subagentFailure,
  subagentStatusOf,
} from '../domain/bot-subagent.policy';
import { cut } from '../domain/bot-tool-text.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import type { BotSubagentRunner, BotSubagentTask } from './bot-tool.factory';

/** What a child runs on that its parent's turn decided: the provider, model and key. */
export type BotSubagentEngine = Pick<
  BotTurnRequest,
  'provider' | 'apiKey' | 'accountId' | 'baseUrl' | 'model' | 'effort'
>;

/** The turn a runner's children belong to, whose chat watches them. */
export interface BotSubagentTurn {
  botId: string;
  turnId: string;
}

/**
 * Runs `delegate`'s children (`25-bots.md` §4.7) on the engine the turn runs
 * on: each a turn of its own with no history, its task as the message, the
 * subagent prompt, and only the tools it is handed (the parent's read-only
 * ones, already behind the owner's permissions). At most
 * `SUBAGENT_CONCURRENCY` run at once; each stops at its own time limit, and
 * all of them when the parent's turn is stopped. One child failing never
 * fails another: every child ends with a run that says how.
 *
 * While they run, the bot's stream hears where each one is each time one
 * moves (it starts, calls a tool, ends), under the `delegate` call's id, so
 * the chat shows them working rather than only once all have ended.
 */
@Injectable()
export class BotSubagentRunnerFactory {
  constructor(
    @Inject(BOT_ENGINE) private readonly engine: BotEngine,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  create(
    engine: BotSubagentEngine,
    botName: string,
    tools: BotEngineTool[],
    turn: BotSubagentTurn,
  ): BotSubagentRunner {
    const systemPrompt = composeSubagentPrompt(botName);
    return {
      run: (tasks, signal, callId) => {
        const board = new ProgressBoard(tasks, (runs) => {
          if (callId)
            void this.stream.publish(turn.botId, { type: 'subagents', ...turn, callId, runs });
        });
        board.publish();
        return inPool(tasks, SUBAGENT_CONCURRENCY, (task, index) =>
          this.child(engine, systemPrompt, tools, task, signal, board.child(index)),
        );
      },
    };
  }

  private async child(
    engine: BotSubagentEngine,
    systemPrompt: string,
    tools: BotEngineTool[],
    { task, context }: BotSubagentTask,
    turn: AbortSignal,
    progress: ChildProgress,
  ): Promise<BotSubagentRun> {
    const tally: Tally = { started: Date.now(), texts: [], toolCalls: [], input: 0, output: 0 };
    // A child still waiting for a slot when the turn is stopped never starts.
    if (turn.aborted) return progress.ended(ended(task, 'cancelled', null, tally));
    progress.started(tally.started);
    const clock = AbortSignal.timeout(SUBAGENT_TIME_LIMIT_MS);
    const signal = AbortSignal.any([turn, clock]);
    let reason: 'completed' | 'cancelled' | 'max_steps' | 'failed' = 'failed';
    let error: string | null = null;
    let scratchDir: string | undefined;
    try {
      scratchDir = await mkdtemp(join(tmpdir(), 'bot-subagent-'));
      for await (const event of this.engine.run({
        ...engine,
        systemPrompt,
        history: [],
        message: composeSubagentTask(task, context),
        tools,
        maxSteps: SUBAGENT_MAX_STEPS,
        signal,
        scratchDir,
      })) {
        if (event.type === 'text.done') tally.texts.push(event.text);
        else if (event.type === 'tool.started') {
          tally.toolCalls.push(event.name);
          progress.called(event.name);
        } else if (event.type === 'usage') {
          tally.input += event.inputTokens;
          tally.output += event.outputTokens;
        } else if (event.type === 'done') {
          reason = event.reason;
          error = event.error ?? null;
        }
      }
    } catch {
      error = 'It could not start.';
    } finally {
      if (scratchDir) await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
    const stopped = turn.aborted ? 'turn' : clock.aborted ? 'time_limit' : null;
    return progress.ended(ended(task, subagentStatusOf(reason, stopped), error, tally));
  }
}

/** One child's hand on the board: what it reports as it moves. */
interface ChildProgress {
  started(at: number): void;
  called(tool: string): void;
  /** Records the end and hands the run back. */
  ended(run: BotSubagentRun): BotSubagentRun;
}

/**
 * Where every child of one `delegate` call is, told whole to `publish` each
 * time one of them moves: a frame is the set, so one that is missed costs
 * nothing the next does not carry.
 */
class ProgressBoard {
  private readonly runs: BotSubagentProgress[];

  constructor(
    tasks: readonly BotSubagentTask[],
    private readonly onChange: (runs: BotSubagentProgress[]) => void,
  ) {
    this.runs = tasks.map(({ task }) => toQueuedSubagentProgress(task));
  }

  publish(): void {
    this.onChange(this.runs.map((run) => ({ ...run, toolCalls: [...run.toolCalls] })));
  }

  child(index: number): ChildProgress {
    const run = this.runs[index];
    return {
      started: (at) => {
        run.state = 'running';
        run.startedAt = new Date(at).toISOString();
        this.publish();
      },
      called: (tool) => {
        run.toolCalls.push(tool);
        this.publish();
      },
      ended: (result) => {
        run.state = result.status;
        run.durationMs = result.durationMs;
        this.publish();
        return result;
      },
    };
  }
}

/** What a child did as it ran: when it started, what it wrote and called, what it cost. */
interface Tally {
  started: number;
  texts: string[];
  toolCalls: string[];
  input: number;
  output: number;
}

/**
 * A child's run: its answer, or, for one that did not complete, why, then
 * what it had written by then.
 */
function ended(
  task: string,
  status: BotSubagentRun['status'],
  error: string | null,
  tally: Tally,
): BotSubagentRun {
  const said = tally.texts.join('\n\n').trim();
  const why = status === 'completed' ? '' : subagentFailure(status, error);
  const result = !why ? said : said ? `${why}\n\nWhat it had written:\n${said}` : why;
  return {
    task,
    status,
    result: cut(result, SUBAGENT_RESULT_MAX),
    toolCalls: tally.toolCalls,
    inputTokens: tally.input,
    outputTokens: tally.output,
    durationMs: Date.now() - tally.started,
  };
}

/** `run` over every item, at most `limit` at once, the results in the items' order. */
async function inPool<Item, Result>(
  items: readonly Item[],
  limit: number,
  run: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index] as Item, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
