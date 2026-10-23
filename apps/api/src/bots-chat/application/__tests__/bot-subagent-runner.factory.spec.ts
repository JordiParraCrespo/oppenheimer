import type {
  BotEngine,
  BotEngineEvent,
  BotEngineTool,
  BotTurnRequest,
} from '@oppenheimer/backend-agents';
import { SUBAGENT_CONCURRENCY } from '../../domain/bot-subagent.policy';
import { BotSubagentRunnerFactory } from '../bot-subagent-runner.factory';

/**
 * How `delegate`'s children run: on the turn's provider, model and key, each
 * a turn of its own with only its task and the tools it was handed, no more
 * than `SUBAGENT_CONCURRENCY` at once, each ending with a run that says how,
 * so one failing never fails the rest, and all of them stopped with the
 * turn. The engine is a double that answers each task as the spec says.
 */
const MODEL = { provider: 'anthropic', apiKey: 'sk-key', model: 'claude-x', effort: null } as const;

type Script = (request: BotTurnRequest) => AsyncIterable<BotEngineEvent>;

function setup(script: Script) {
  const requests: BotTurnRequest[] = [];
  const engine = {
    run: (request: BotTurnRequest) => {
      requests.push(request);
      return script(request);
    },
  } as unknown as BotEngine;
  return { requests, factory: new BotSubagentRunnerFactory(engine) };
}

/** A child that calls a tool, writes `text`, and ends as told. */
function answering(
  text: (task: string) => string,
  end: Extract<BotEngineEvent, { type: 'done' }> = { type: 'done', reason: 'completed' },
): Script {
  return async function* (request) {
    yield { type: 'tool.started', callId: 'c1', name: 'list_hosts', input: {} };
    yield { type: 'usage', inputTokens: 100, outputTokens: 20 };
    yield { type: 'text.done', text: text(request.message) };
    yield end;
  };
}

/** Resolves when the signal aborts, as an engine's stream does once stopped. */
const aborted = (signal: AbortSignal) =>
  new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));

const tool: BotEngineTool = {
  name: 'list_hosts',
  description: 'Lists hosts.',
  inputSchema: { type: 'object' },
  run: async () => ({ content: 'none' }),
};

describe('BotSubagentRunnerFactory', () => {
  it('runs each task as its own turn on the turn’s model, with only its task and tools, and reports it in order', async () => {
    const { requests, factory } = setup(answering((task) => `Found ${task}`));
    const runner = factory.create(MODEL, 'Oppie', [tool]);

    const runs = await runner.run(
      [{ task: 'alpha' }, { task: 'beta', context: 'repo acme/api' }],
      new AbortController().signal,
    );

    expect(runs.map((run) => [run.task, run.status, run.result])).toEqual([
      ['alpha', 'completed', 'Found alpha'],
      ['beta', 'completed', 'Found beta\n\nContext from the bot:\nrepo acme/api'],
    ]);
    expect(runs[0]).toMatchObject({
      toolCalls: ['list_hosts'],
      inputTokens: 100,
      outputTokens: 20,
    });
    for (const request of requests) {
      expect(request).toMatchObject({ ...MODEL, history: [], tools: [tool], maxSteps: 8 });
      expect(request.systemPrompt).toContain('working for the bot Oppie');
      expect(request.systemPrompt).toContain('You can only read');
    }
  });

  it(`never runs more than ${SUBAGENT_CONCURRENCY} children at once`, async () => {
    let running = 0;
    let most = 0;
    const { factory } = setup(async function* () {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      yield { type: 'text.done', text: 'ok' };
      yield { type: 'done', reason: 'completed' };
    });

    const runs = await factory.create(MODEL, 'Oppie', []).run(
      ['a', 'b', 'c', 'd'].map((task) => ({ task })),
      new AbortController().signal,
    );

    expect(runs).toHaveLength(4);
    expect(most).toBe(SUBAGENT_CONCURRENCY);
  });

  it('keeps the others’ answers when one child fails, saying why it failed and what it had written', async () => {
    const { factory } = setup(async function* (request) {
      if (request.message === 'bad') {
        yield { type: 'text.done', text: 'Half way' };
        yield { type: 'done', reason: 'failed', error: 'model overloaded' };
        return;
      }
      yield { type: 'text.done', text: 'All good' };
      yield { type: 'done', reason: 'completed' };
    });

    const runs = await factory
      .create(MODEL, 'Oppie', [])
      .run([{ task: 'good' }, { task: 'bad' }], new AbortController().signal);

    expect(runs.map((run) => run.status)).toEqual(['completed', 'failed']);
    expect(runs[0]?.result).toBe('All good');
    expect(runs[1]?.result).toBe('model overloaded\n\nWhat it had written:\nHalf way');
  });

  it('stops every child, running or waiting, when the turn is stopped, and reports each cancelled', async () => {
    const signals: AbortSignal[] = [];
    const { factory } = setup(async function* (request) {
      signals.push(request.signal);
      await aborted(request.signal);
      yield { type: 'done', reason: 'cancelled' };
    });
    const turn = new AbortController();

    const pending = factory.create(MODEL, 'Oppie', []).run(
      ['a', 'b', 'c', 'd'].map((task) => ({ task })),
      turn.signal,
    );
    await vi.waitFor(() => expect(signals).toHaveLength(SUBAGENT_CONCURRENCY));
    turn.abort();
    const runs = await pending;

    expect(runs.map((run) => run.status)).toEqual([
      'cancelled',
      'cancelled',
      'cancelled',
      'cancelled',
    ]);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(runs[0]?.result).toBe('Stopped with the turn.');
  });
});
