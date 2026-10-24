import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { BotEngine, BotEngineTool, BotTurnRequest } from '@oppenheimer/backend-agents';
import type { BotSubagentRun } from '@oppenheimer/shared';
import { BOT_ENGINE } from '../bots-chat.di-tokens';
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
import type { BotSubagentRunner, BotSubagentTask } from './bot-tool.factory';

/** What a child runs on that its parent's turn decided: the provider, model and key. */
export type BotSubagentEngine = Pick<
  BotTurnRequest,
  'provider' | 'apiKey' | 'accountId' | 'baseUrl' | 'model' | 'effort'
>;

/**
 * Runs `delegate`'s children (`25-bots.md` §4.7) on the engine the turn runs
 * on: each a turn of its own with no history, its task as the message, the
 * subagent prompt, and only the tools it is handed (the parent's read-only
 * ones, already behind the owner's permissions). At most
 * `SUBAGENT_CONCURRENCY` run at once; each stops at its own time limit, and
 * all of them when the parent's turn is stopped. One child failing never
 * fails another: every child ends with a run that says how.
 */
@Injectable()
export class BotSubagentRunnerFactory {
  constructor(@Inject(BOT_ENGINE) private readonly engine: BotEngine) {}

  create(engine: BotSubagentEngine, botName: string, tools: BotEngineTool[]): BotSubagentRunner {
    const systemPrompt = composeSubagentPrompt(botName);
    return {
      run: (tasks, signal) =>
        inPool(tasks, SUBAGENT_CONCURRENCY, (task) =>
          this.child(engine, systemPrompt, tools, task, signal),
        ),
    };
  }

  private async child(
    engine: BotSubagentEngine,
    systemPrompt: string,
    tools: BotEngineTool[],
    { task, context }: BotSubagentTask,
    turn: AbortSignal,
  ): Promise<BotSubagentRun> {
    const tally: Tally = { started: Date.now(), texts: [], toolCalls: [], input: 0, output: 0 };
    // A child still waiting for a slot when the turn is stopped never starts.
    if (turn.aborted) return ended(task, 'cancelled', null, tally);
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
        else if (event.type === 'tool.started') tally.toolCalls.push(event.name);
        else if (event.type === 'usage') {
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
    return ended(task, subagentStatusOf(reason, stopped), error, tally);
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
  run: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index] as Item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
