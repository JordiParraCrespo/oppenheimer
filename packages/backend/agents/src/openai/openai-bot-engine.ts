import type { AgentInputItem } from '@openai/agents';
import {
  BotEngine,
  type BotEngineEvent,
  type BotTurnRequest,
  DEFAULT_MAX_STEPS,
} from '../bot-engine';
import { failed, guardTurn, runTool, ToolCallData } from '../turn';
import { OpenAiEventTranslator, type OpenAiStreamEvent } from './openai-events';

/**
 * A non-strict tool's parameters as the SDK types them. The SDK sends the
 * schema as it is given, but its type asks for fields (`properties`,
 * `required`, `additionalProperties: true`) a valid JSON Schema need not
 * have; `toolParameters` is the one place ours is taken as this.
 */
type JsonObjectSchema = {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required: string[];
  additionalProperties: true;
};

function toolParameters(inputSchema: Record<string, unknown>): JsonObjectSchema {
  return inputSchema as JsonObjectSchema;
}

/** The part of the SDK's streamed result this adapter reads. */
interface OpenAiRun extends AsyncIterable<OpenAiStreamEvent> {
  readonly completed: Promise<void>;
  readonly error: unknown;
}

/** The history as Responses API input items, then this turn's message. */
function inputItems(request: BotTurnRequest): AgentInputItem[] {
  return [
    ...request.history.map(
      ({ role, text }): AgentInputItem =>
        role === 'user'
          ? { type: 'message', role: 'user', content: text }
          : {
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'output_text', text }],
            },
    ),
    userMessage(request),
  ];
}

/** This turn's message: its text, or its images then its text as input parts. */
function userMessage(request: BotTurnRequest): AgentInputItem {
  const images = request.images ?? [];
  if (images.length === 0) return { type: 'message', role: 'user', content: request.message };
  return {
    type: 'message',
    role: 'user',
    content: [
      ...images.map((image) => ({
        type: 'input_image' as const,
        image: `data:${image.mimeType};base64,${image.data}`,
      })),
      ...(request.message ? [{ type: 'input_text' as const, text: request.message }] : []),
    ],
  };
}

/**
 * Where a turn's requests go and what they carry besides its effort: the
 * endpoint, and the model settings that endpoint requires. A subclass that
 * reaches another Responses API endpoint says so here and nowhere else.
 */
export interface ResponsesEndpoint {
  baseUrl?: string;
  modelSettings: Record<string, unknown>;
}

/** Provider `openai`, on the OpenAI Agents SDK over the Responses API. */
export class OpenAiBotEngine extends BotEngine {
  run(request: BotTurnRequest): AsyncIterable<BotEngineEvent> {
    const endpoint = this.endpoint(request);
    if (typeof endpoint === 'string') return guardTurn(request, () => [failed(endpoint)]);
    return guardTurn(request, () => this.stream(request, endpoint));
  }

  /** OpenAI's API, or the request's `baseUrl`; a string refuses the turn with that reason. */
  protected endpoint(request: BotTurnRequest): ResponsesEndpoint | string {
    return { baseUrl: request.baseUrl, modelSettings: {} };
  }

  private async *stream(
    request: BotTurnRequest,
    endpoint: ResponsesEndpoint,
  ): AsyncGenerator<BotEngineEvent> {
    const { baseUrl } = endpoint;
    // Loaded on the first turn, so importing the package starts nothing.
    const sdk = await import('@openai/agents');
    const failedCalls = new Set<string>();
    const made = new ToolCallData();
    const translator = new OpenAiEventTranslator((callId) => failedCalls.has(callId), made);

    const modelProvider = new sdk.OpenAIProvider({
      apiKey: request.apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
    // Tracing would export the turn to OpenAI's trace store under a key read
    // from the environment; a bot's turn is recorded by Oppenheimer.
    const runner = new sdk.Runner({ modelProvider, tracingDisabled: true });
    const agent = new sdk.Agent({
      name: 'bot',
      instructions: request.systemPrompt,
      model: request.model,
      tools: request.tools.map((tool) =>
        sdk.tool({
          name: tool.name,
          description: tool.description,
          parameters: toolParameters(tool.inputSchema),
          strict: false,
          execute: async (input, _context, details) => {
            const result = await runTool(tool, input, {
              signal: request.signal,
              apiKey: request.apiKey,
            });
            const callId = details?.toolCall?.callId;
            if (result.isError && callId) failedCalls.add(callId);
            made.record(callId, result.data);
            return result.content;
          },
        }),
      ),
      modelSettings: {
        ...(request.effort ? { reasoning: { effort: request.effort } } : {}),
        ...endpoint.modelSettings,
      },
    });
    const run: OpenAiRun = await runner.run(agent, inputItems(request), {
      stream: true,
      signal: request.signal,
      maxTurns: request.maxSteps ?? DEFAULT_MAX_STEPS,
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
