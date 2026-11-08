import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_ENGINE_FAILURES,
  BotEngine,
  type BotEngineEvent,
  type BotTurnRequest,
} from '@oppenheimer/backend-agents';
import { InjectMetric, type ModuleMetrics } from '@oppenheimer/backend-core';
import { BOT_PROVIDERS } from '@oppenheimer/shared';

export const BOT_ENGINE_RUNS_TOTAL = 'bot_engine_runs_total';
export const BOT_ENGINE_FAILURES_TOTAL = 'bot_engine_failures_total';
export const BOT_ENGINE_RUN_DURATION_SECONDS = 'bot_engine_run_duration_seconds';
export const BOT_ENGINE_RUNS_ACTIVE = 'bot_engine_runs_active';
export const BOT_ENGINE_TOKENS_TOTAL = 'bot_engine_tokens_total';
export const BOT_ENGINE_TOOL_CALLS_TOTAL = 'bot_engine_tool_calls_total';
export const BOT_ENGINE_RETRIES_TOTAL = 'bot_engine_retries_total';

/** The engine that runs inside the meter: the one `createBotEngine` builds. */
export const INNER_BOT_ENGINE = Symbol('INNER_BOT_ENGINE');

/**
 * How a run ended, as its `done` said, or `incomplete` when the stream stopped
 * without one (the caller stopped reading, or the engine broke its contract).
 */
const RUN_REASONS = ['completed', 'cancelled', 'max_steps', 'failed', 'incomplete'] as const;
/**
 * A `turn` is a bot's chat turn or a subagent's; a `completion` is one tool-less
 * round trip for a bot (a summary, a goal's verdict: `BotEngine.complete`).
 */
const RUN_KINDS = ['turn', 'completion'] as const;
type RunKind = (typeof RUN_KINDS)[number];
/** `input` counts every input token, cached or not; `cache_read` is the share of it the provider's cache served. */
const TOKEN_TYPES = ['input', 'output', 'cache_read', 'cache_write'] as const;

const RUN_LABELS = ['provider', 'kind'] as const;

export const BotEngineMetrics: ModuleMetrics = {
  [BOT_ENGINE_RUNS_TOTAL]: {
    type: 'counter',
    help: 'Bot engine runs that ended, by provider, kind (turn, completion) and how they ended',
    labelNames: [...RUN_LABELS, 'reason'],
  },
  [BOT_ENGINE_FAILURES_TOTAL]: {
    type: 'counter',
    help: 'Bot engine runs that ended failed, by provider, kind and the kind of failure the engine named',
    labelNames: [...RUN_LABELS, 'failure'],
  },
  [BOT_ENGINE_RUN_DURATION_SECONDS]: {
    type: 'histogram',
    help: 'Wall time of a bot engine run, from its start to its last event, tools included',
    labelNames: RUN_LABELS,
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800],
  },
  [BOT_ENGINE_RUNS_ACTIVE]: {
    type: 'gauge',
    help: 'Bot engine runs in progress in this process, by provider and kind',
    labelNames: RUN_LABELS,
  },
  [BOT_ENGINE_TOKENS_TOTAL]: {
    type: 'counter',
    help: 'Tokens bot engine runs spent as the provider reported them; input includes cache_read, so cache_read / input is the prompt cache hit rate',
    labelNames: [...RUN_LABELS, 'type'],
  },
  [BOT_ENGINE_TOOL_CALLS_TOTAL]: {
    type: 'counter',
    help: 'Tool calls bot engine runs finished, by provider and whether the tool answered an error',
    labelNames: ['provider', 'result'],
  },
  [BOT_ENGINE_RETRIES_TOTAL]: {
    type: 'counter',
    help: 'Calls the provider refused and the engine waits to try again, by provider and reason',
    labelNames: ['provider', 'reason'],
  },
};

interface CounterLike {
  inc(labels: Record<string, string>, value?: number): void;
}
interface GaugeLike {
  inc(labels: Record<string, string>, value?: number): void;
  dec(labels: Record<string, string>, value?: number): void;
  set(labels: Record<string, string>, value: number): void;
}
interface HistogramLike {
  observe(labels: Record<string, string>, value: number): void;
  zero(labels: Record<string, string>): void;
}

/** What `BotEngine.completeWithUsage` sends: one step, none of our tools and none of the engine's. */
function kindOf(request: BotTurnRequest): RunKind {
  return request.maxSteps === 1 && request.tools.length === 0 && request.engineTools === false
    ? 'completion'
    : 'turn';
}

/**
 * The bot engine, metered: every run (a turn, a subagent's, a completion)
 * passes through here, so what the bots do is counted in one place rather than
 * at each caller. It reads the events and changes none of them; the stream is
 * the inner engine's, event for event.
 *
 * Labels are closed sets (the providers, the kinds, the reasons and failures
 * the engine names), never a bot, an organization or a model: those are in
 * the database (`bot_turn`, `bot_model_call`, `/usage`), and as labels they
 * would grow a series per bot.
 */
@Injectable()
export class MeteredBotEngine extends BotEngine {
  constructor(
    @Inject(INNER_BOT_ENGINE) private readonly inner: BotEngine,
    @InjectMetric(BOT_ENGINE_RUNS_TOTAL) private readonly runs: CounterLike,
    @InjectMetric(BOT_ENGINE_FAILURES_TOTAL) private readonly failures: CounterLike,
    @InjectMetric(BOT_ENGINE_RUN_DURATION_SECONDS) private readonly duration: HistogramLike,
    @InjectMetric(BOT_ENGINE_RUNS_ACTIVE) private readonly active: GaugeLike,
    @InjectMetric(BOT_ENGINE_TOKENS_TOTAL) private readonly tokens: CounterLike,
    @InjectMetric(BOT_ENGINE_TOOL_CALLS_TOTAL) private readonly toolCalls: CounterLike,
    @InjectMetric(BOT_ENGINE_RETRIES_TOTAL) private readonly retries: CounterLike,
  ) {
    super();
    this.zero();
  }

  async *run(request: BotTurnRequest): AsyncIterable<BotEngineEvent> {
    const labels = { provider: request.provider, kind: kindOf(request) };
    const start = performance.now();
    let reason: (typeof RUN_REASONS)[number] = 'incomplete';
    this.active.inc(labels);
    try {
      for await (const event of this.inner.run(request)) {
        if (event.type === 'done') {
          reason = event.reason;
          if (event.reason === 'failed') {
            this.failures.inc({ ...labels, failure: event.failure ?? 'other' });
          }
        } else {
          this.observe(event, labels);
        }
        yield event;
      }
    } finally {
      this.active.dec(labels);
      this.runs.inc({ ...labels, reason });
      this.duration.observe(labels, (performance.now() - start) / 1_000);
    }
  }

  private observe(event: BotEngineEvent, labels: { provider: string; kind: RunKind }): void {
    switch (event.type) {
      case 'usage':
        this.tokens.inc({ ...labels, type: 'input' }, event.inputTokens);
        this.tokens.inc({ ...labels, type: 'output' }, event.outputTokens);
        this.tokens.inc({ ...labels, type: 'cache_read' }, event.cacheReadTokens ?? 0);
        this.tokens.inc({ ...labels, type: 'cache_write' }, event.cacheWriteTokens ?? 0);
        return;
      case 'tool.finished':
        this.toolCalls.inc({ provider: labels.provider, result: event.isError ? 'error' : 'ok' });
        return;
      case 'retrying':
        this.retries.inc({ provider: labels.provider, reason: event.reason });
        return;
      default:
        return;
    }
  }

  /**
   * Every series at zero from boot, so a ratio over failures or cache reads is
   * a 0 before the first one rather than an absent series an alert cannot see.
   */
  private zero(): void {
    for (const provider of BOT_PROVIDERS) {
      for (const kind of RUN_KINDS) {
        const labels = { provider, kind };
        for (const reason of RUN_REASONS) this.runs.inc({ ...labels, reason }, 0);
        for (const failure of BOT_ENGINE_FAILURES) this.failures.inc({ ...labels, failure }, 0);
        for (const type of TOKEN_TYPES) this.tokens.inc({ ...labels, type }, 0);
        this.active.set(labels, 0);
        this.duration.zero(labels);
      }
      for (const result of ['ok', 'error']) this.toolCalls.inc({ provider, result }, 0);
      for (const reason of ['rate_limit', 'unavailable']) this.retries.inc({ provider, reason }, 0);
    }
  }
}
