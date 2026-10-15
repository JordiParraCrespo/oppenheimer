import {
  BotEngine,
  type BotEngineEvent,
  type BotTurnRequest,
  DEFAULT_MAX_STEPS,
} from '../bot-engine';
import { guardTurn, runTool } from '../turn';
import { OpenAiEventTranslator, type OpenAiStreamEvent } from './openai-events';

/** One of our tools as the adapter hands it to the SDK. */
export interface OpenAiToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(input: unknown, callId: string | undefined): Promise<string>;
}

/** Everything one streamed run needs, in plain types. */
export interface OpenAiRunSpec {
  apiKey: string;
  baseUrl?: string;
  model: string;
  instructions: string;
  effort?: string;
  tools: OpenAiToolSpec[];
  /** Responses API input items: the history, then this turn's message. */
  input: unknown[];
  maxTurns: number;
  signal: AbortSignal;
}

/** A streamed run: its events, then how it ended. */
export interface OpenAiRun extends AsyncIterable<OpenAiStreamEvent> {
  readonly completed: Promise<void>;
  readonly error: unknown;
}

/** Starts a run. The SDK's `Runner` in production; a scripted stream in tests. */
export type OpenAiStart = (spec: OpenAiRunSpec) => Promise<OpenAiRun>;

const sdkStart: OpenAiStart = async (spec) => {
  // Loaded on the first turn, so importing the package starts nothing.
  const sdk = await import('@openai/agents');
  const modelProvider = new sdk.OpenAIProvider({
    apiKey: spec.apiKey,
    ...(spec.baseUrl ? { baseURL: spec.baseUrl } : {}),
  });
  // Tracing would export the turn to OpenAI's trace store under a key read
  // from the environment; a bot's turn is recorded by Oppenheimer.
  const runner = new sdk.Runner({ modelProvider, tracingDisabled: true });
  const agent = new sdk.Agent({
    name: 'bot',
    instructions: spec.instructions,
    model: spec.model,
    tools: spec.tools.map((tool) =>
      sdk.tool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as never,
        strict: false,
        execute: (input, _context, details) => tool.execute(input, details?.toolCall?.callId),
      }),
    ),
    modelSettings: spec.effort
      ? { reasoning: { effort: spec.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max' } }
      : {},
  });
  const result = await runner.run(agent, spec.input as never, {
    stream: true,
    signal: spec.signal,
    maxTurns: spec.maxTurns,
  });
  return result as unknown as OpenAiRun;
};

function inputItems(request: BotTurnRequest): unknown[] {
  return [
    ...request.history.map(({ role, text }) =>
      role === 'user'
        ? { type: 'message', role: 'user', content: text }
        : {
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text }],
          },
    ),
    { type: 'message', role: 'user', content: request.message },
  ];
}

/** Provider `openai`, on the OpenAI Agents SDK over the Responses API. */
export class OpenAiBotEngine extends BotEngine {
  constructor(private readonly start: OpenAiStart = sdkStart) {
    super();
  }

  run(request: BotTurnRequest): AsyncIterable<BotEngineEvent> {
    return guardTurn(request, () => this.stream(request));
  }

  private async *stream(request: BotTurnRequest): AsyncGenerator<BotEngineEvent> {
    const failedCalls = new Set<string>();
    const translator = new OpenAiEventTranslator((callId) => failedCalls.has(callId));
    const tools: OpenAiToolSpec[] = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      execute: async (input, callId) => {
        const result = await runTool(tool, input, request.signal);
        if (result.isError && callId) failedCalls.add(callId);
        return result.content;
      },
    }));

    const run = await this.start({
      apiKey: request.apiKey,
      ...(request.baseUrl ? { baseUrl: request.baseUrl } : {}),
      model: request.model,
      instructions: request.systemPrompt,
      ...(request.effort ? { effort: request.effort } : {}),
      tools,
      input: inputItems(request),
      maxTurns: request.maxSteps ?? DEFAULT_MAX_STEPS,
      signal: request.signal,
    });

    let error: unknown;
    try {
      for await (const event of run) {
        yield* translator.translate(event);
      }
      await run.completed;
      error = run.error;
    } catch (thrown) {
      error = thrown;
    }
    yield* translator.finish(error);
  }
}
