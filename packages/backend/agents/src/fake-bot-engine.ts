import { BotEngine, type BotEngineEvent, type BotTurnRequest } from './bot-engine';
import { guardTurn, runTool, toAsync } from './turn';

/**
 * An engine for the API's tests: it replays the events a script returns
 * for each request, under the same contract as the real engines.
 *
 * - A scripted `tool.started` naming one of the request's tools runs that
 *   tool, as a model's call would, and the fake reports its `tool.finished`
 *   right after; a scripted `tool.finished` for that call is dropped. A
 *   `tool.started` naming no tool of the request passes through, and the
 *   script reports its end.
 * - A script that ends without `done` ends with `done: completed`.
 * - An abort ends the turn with `done: cancelled`; a script that throws
 *   ends it with `done: failed`.
 */
export class FakeBotEngine extends BotEngine {
  constructor(
    private readonly script: (
      request: BotTurnRequest,
    ) => AsyncIterable<BotEngineEvent> | BotEngineEvent[],
  ) {
    super();
  }

  run(request: BotTurnRequest): AsyncIterable<BotEngineEvent> {
    return guardTurn(request, () => this.play(request));
  }

  private async *play(request: BotTurnRequest): AsyncGenerator<BotEngineEvent> {
    const tools = new Map(request.tools.map((tool) => [tool.name, tool]));
    const ranByFake = new Set<string>();
    for await (const event of toAsync(this.script(request))) {
      if (event.type === 'tool.finished' && ranByFake.has(event.callId)) continue;
      yield event;
      if (event.type === 'done') return;
      if (event.type !== 'tool.started') continue;
      const tool = tools.get(event.name);
      if (!tool) continue;
      ranByFake.add(event.callId);
      const result = await runTool(tool, event.input, request.signal);
      yield {
        type: 'tool.finished',
        callId: event.callId,
        name: event.name,
        output: result.content,
        isError: result.isError,
      };
    }
    yield { type: 'done', reason: 'completed' };
  }
}
