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
} as const satisfies Record<string, ErrorDefinition>;
