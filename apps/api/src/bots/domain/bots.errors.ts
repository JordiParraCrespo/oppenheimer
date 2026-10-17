import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const BotErrors = {
  /** Also a bot in another workspace: the scoped read cannot see it. */
  NOT_FOUND: {
    code: 'BOTS_001',
    message: 'Bot not found',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'BOTS_002',
    message: 'Bots belong to an organization',
    httpStatus: 400,
  },
  /** Also a group in another workspace. */
  GROUP_NOT_FOUND: {
    code: 'BOTS_003',
    message: 'Bot group not found',
    httpStatus: 404,
  },
  /** Group names are unique in a workspace, whatever their case. */
  GROUP_NAME_TAKEN: {
    code: 'BOTS_004',
    message: 'A group with that name already exists',
    httpStatus: 409,
  },
  /** A bot has two documents, `soul` and `instructions`; any other name is none of them. */
  DOCUMENT_NOT_FOUND: {
    code: 'BOTS_005',
    message: 'Bot document not found',
    httpStatus: 404,
  },
  /** Somebody saved the document since this editor loaded it. */
  DOCUMENT_CONFLICT: {
    code: 'BOTS_006',
    message: 'The document was changed since it was loaded',
    httpStatus: 409,
  },
  REVISION_NOT_FOUND: {
    code: 'BOTS_007',
    message: 'Revision not found',
    httpStatus: 404,
  },
  MEMORY_FACT_NOT_FOUND: {
    code: 'BOTS_008',
    message: 'Memory fact not found',
    httpStatus: 404,
  },
  /** The bot reads every fact before each turn, so a bot keeps a bounded number. */
  MEMORY_FULL: {
    code: 'BOTS_009',
    message: 'The bot remembers as much as it can',
    httpStatus: 422,
  },
  /** A bot's model is one its provider offers (`BOT_PROVIDER_CATALOG`). */
  MODEL_UNSUPPORTED: {
    code: 'BOTS_010',
    message: 'That model cannot run a bot',
    httpStatus: 422,
  },
  /** `BOTS_PROVIDER_KEY` is unset, so no provider key can be stored or read. */
  PROVIDERS_NOT_CONFIGURED: {
    code: 'BOTS_011',
    message: 'Model providers are not configured on this server',
    httpStatus: 503,
  },
  /** A provider the catalog does not list (`BOT_PROVIDERS`). */
  PROVIDER_NOT_FOUND: {
    code: 'BOTS_012',
    message: 'No such model provider',
    httpStatus: 404,
  },
  /** The bot's provider has no key in the workspace, so it cannot answer. */
  PROVIDER_KEY_MISSING: {
    code: 'BOTS_013',
    message: "The bot's model provider has no key",
    httpStatus: 409,
  },
  TURN_NOT_FOUND: {
    code: 'BOTS_014',
    message: 'Turn not found',
    httpStatus: 404,
  },
  /** Also an approval of another bot, or in another workspace. */
  APPROVAL_NOT_FOUND: {
    code: 'BOTS_015',
    message: 'Approval not found',
    httpStatus: 404,
  },
  /** It was approved, denied, or expired by a new message, before this decision arrived. */
  APPROVAL_DECIDED: {
    code: 'BOTS_016',
    message: 'The approval was already decided',
    httpStatus: 409,
  },
  /** ChatGPT runs on a sign-in to a subscription (`chatgpt/login`), never on a typed key. */
  CHATGPT_SIGN_IN_ONLY: {
    code: 'BOTS_017',
    message: 'ChatGPT connects by signing in, not with a key',
    httpStatus: 422,
  },
  /** The sign-in being polled ran past its time, or was started for another workspace. */
  CHATGPT_LOGIN_EXPIRED: {
    code: 'BOTS_018',
    message: 'The ChatGPT sign-in expired',
    httpStatus: 410,
  },
  /** OpenAI's sign-in server refused for rate, or too many calls to it were waiting. */
  CHATGPT_RATE_LIMITED: {
    code: 'BOTS_019',
    message: "ChatGPT's sign-in is busy; try again shortly",
    httpStatus: 429,
  },
  /** OpenAI's sign-in server did not answer, or answered something unusable. */
  CHATGPT_UNREACHABLE: {
    code: 'BOTS_020',
    message: "ChatGPT's sign-in could not be reached",
    httpStatus: 502,
  },
  /** Another replica is refreshing the workspace's ChatGPT sign-in; a turn that needs it now fails rather than waits. */
  CHATGPT_REFRESHING: {
    code: 'BOTS_021',
    message: 'The ChatGPT sign-in is being refreshed',
    httpStatus: 409,
  },
  /** Clear history while a turn is queued or running: the turn would write into a conversation that is gone. */
  CONVERSATION_BUSY: {
    code: 'BOTS_022',
    message: 'The bot has a turn queued or running',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
