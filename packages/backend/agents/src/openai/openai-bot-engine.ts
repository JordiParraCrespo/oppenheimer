import type { AgentInputItem } from '@openai/agents';
import {
  BotEngine,
  type BotEngineEvent,
  type BotTurnRequest,
  DEFAULT_MAX_STEPS,
} from '../bot-engine';
import { failed, guardTurn, runTool } from '../turn';
import { CHATGPT_BACKEND_URL, chatgptModelSettings } from './chatgpt-backend';
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
    { type: 'message', role: 'user', content: request.message },
  ];
}

/** The model settings of a turn: its effort, and on `chatgpt` what that backend requires. */
function modelSettings(request: BotTurnRequest, accountId: string | null) {
  return {
    ...(request.effort ? { reasoning: { effort: request.effort } } : {}),
    ...(accountId ? chatgptModelSettings(accountId) : {}),
  };
}

/**
 * Providers `openai` and `chatgpt`, on the OpenAI Agents SDK over the
 * Responses API: OpenAI's API on a key, or ChatGPT's backend on a sign-in.
 */
export class OpenAiBotEngine extends BotEngine {
  run(request: BotTurnRequest): AsyncIterable<BotEngineEvent> {
    if (request.provider === 'chatgpt' && !request.accountId) {
      return guardTurn(request, () => [failed('A ChatGPT turn needs the account it acts for')]);
    }
    return guardTurn(request, () => this.stream(request));
  }

  private async *stream(request: BotTurnRequest): AsyncGenerator<BotEngineEvent> {
    const accountId = request.provider === 'chatgpt' ? (request.accountId ?? null) : null;
    const baseUrl = request.baseUrl ?? (accountId ? CHATGPT_BACKEND_URL : undefined);
    // Loaded on the first turn, so importing the package starts nothing.
    const sdk = await import('@openai/agents');
    const failedCalls = new Set<string>();
    const translator = new OpenAiEventTranslator((callId) => failedCalls.has(callId));

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
            return result.content;
          },
        }),
      ),
      modelSettings: modelSettings(request, accountId),
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
