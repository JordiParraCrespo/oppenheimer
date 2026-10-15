import type { BotTurnRequest } from '../bot-engine';
import { OpenAiBotEngine, type ResponsesEndpoint } from './openai-bot-engine';

/**
 * A ChatGPT subscription's way to the models: the Responses API as ChatGPT
 * serves it to the Codex CLI, on the sign-in's access token instead of an API
 * key. OpenClaw and the Codex CLI reach it the same way.
 */
const CHATGPT_BACKEND_URL = 'https://chatgpt.com/backend-api/codex';

/** Who the requests say they come from, in the header the backend reads it from. */
const ORIGINATOR = 'oppenheimer';

/**
 * Provider `chatgpt`: the OpenAI engine pointed at ChatGPT's backend. It
 * differs from OpenAI's API in what a request must carry: the account the
 * token acts for, `store: false` (nothing is kept on ChatGPT's side, so every
 * request sends the whole conversation, which the engine does anyway), and the
 * reasoning sent back encrypted, so a turn's later steps can pass it on.
 */
export class ChatgptBotEngine extends OpenAiBotEngine {
  protected override endpoint(request: BotTurnRequest): ResponsesEndpoint | string {
    if (!request.accountId) return 'A ChatGPT turn needs the account it acts for';
    return {
      baseUrl: request.baseUrl ?? CHATGPT_BACKEND_URL,
      modelSettings: {
        store: false,
        providerData: {
          include: ['reasoning.encrypted_content'],
          extraHeaders: {
            'chatgpt-account-id': request.accountId,
            'OpenAI-Beta': 'responses=experimental',
            originator: ORIGINATOR,
          },
        },
      },
    };
  }
}
