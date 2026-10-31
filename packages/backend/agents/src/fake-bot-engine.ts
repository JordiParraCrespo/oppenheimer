import {
  BotEngine,
  type BotEngineEvent,
  type BotToolData,
  type BotTurnRequest,
} from './bot-engine';
import { guardTurn, runTool, toAsync } from './turn';

type ToolStarted = Extract<BotEngineEvent, { type: 'tool.started' }>;

/**
 * A tool call in a script. Without `result` the fake runs the request's
 * tool of that name, as a model's call would; with it, the fake reports
 * `result` instead and runs nothing.
 */
export type FakeToolCall = ToolStarted & {
  result?: { output: string; isError?: boolean; data?: BotToolData };
};

/**
 * What a script yields: the engine's events, with tool calls as
 * `FakeToolCall`. A tool's end is never scripted; the fake reports it.
 */
export type FakeScriptEvent =
  | Exclude<BotEngineEvent, { type: 'tool.started' | 'tool.finished' }>
  | FakeToolCall;

/**
 * An engine for the API's tests: it replays the events a script returns
 * for each request, under the same contract as the real engines.
 *
 * - Every scripted `tool.started` is followed by the fake's `tool.finished`:
 *   the call's scripted `result` when it has one; otherwise the output of
 *   the request's tool of that name, which the fake runs; otherwise an
 *   unknown-tool error, as a real engine reports a tool it does not have.
 * - After each call, the fake asks the request's `steering` for what the
 *   person sent meanwhile, as a real engine does at that boundary, and
 *   reports what it took as `steered` after the call's `tool.finished`.
 * - A script that ends without `done` ends with `done: completed`.
 * - An abort ends the turn with `done: cancelled`; a script that throws
 *   ends it with `done: failed`.
 */
export class FakeBotEngine extends BotEngine {
  constructor(
    private readonly script: (
      request: BotTurnRequest,
    ) => AsyncIterable<FakeScriptEvent> | FakeScriptEvent[],
  ) {
    super();
  }

  run(request: BotTurnRequest): AsyncIterable<BotEngineEvent> {
    return guardTurn(request, () => this.play(request));
  }

  private async *play(request: BotTurnRequest): AsyncGenerator<BotEngineEvent> {
    for await (const event of toAsync(this.script(request))) {
      if (event.type !== 'tool.started') {
        yield event;
        if (event.type === 'done') return;
        continue;
      }
      const { result, ...started } = event;
      yield started;
      const { output, isError, data } = result ?? (await this.callTool(request, started));
      yield {
        type: 'tool.finished',
        callId: started.callId,
        name: started.name,
        output,
        isError: isError === true,
        ...(data ? { data } : {}),
      };
      const steers = request.steering ? await request.steering.take() : [];
      if (steers.length > 0) yield { type: 'steered', callId: started.callId, steers };
    }
    yield { type: 'done', reason: 'completed' };
  }

  private async callTool(
    request: BotTurnRequest,
    call: ToolStarted,
  ): Promise<{ output: string; isError: boolean; data?: BotToolData }> {
    const tool = request.tools.find(({ name }) => name === call.name);
    if (!tool) return { output: `Unknown tool: ${call.name}`, isError: true };
    const { content, ...rest } = await runTool(tool, call.input, {
      signal: request.signal,
      apiKey: request.apiKey,
      callId: call.callId,
    });
    return { output: content, ...rest };
  }
}
