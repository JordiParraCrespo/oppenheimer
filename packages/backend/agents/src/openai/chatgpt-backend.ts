/**
 * A ChatGPT subscription's way to the models: the Responses API as ChatGPT
 * serves it to the Codex CLI, on the sign-in's access token instead of an API
 * key. OpenClaw and the Codex CLI reach it the same way.
 *
 * It differs from OpenAI's API in what a request must carry: the account the
 * token acts for, `store: false` (nothing is kept on ChatGPT's side, so every
 * request sends the whole conversation, which the engine does anyway), and the
 * reasoning sent back encrypted, so a turn's later steps can pass it on.
 */
export const CHATGPT_BACKEND_URL = 'https://chatgpt.com/backend-api/codex';

/** Who the requests say they come from, in the header the backend reads it from. */
const ORIGINATOR = 'oppenheimer';

/** The model settings every `chatgpt` turn runs with, besides its effort. */
export function chatgptModelSettings(accountId: string) {
  return {
    store: false,
    providerData: {
      include: ['reasoning.encrypted_content'],
      extraHeaders: {
        'chatgpt-account-id': accountId,
        'OpenAI-Beta': 'responses=experimental',
        originator: ORIGINATOR,
      },
    },
  };
}
