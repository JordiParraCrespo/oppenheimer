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
  /** A bot runs Claude Code, so its model is one of Claude Code's. */
  MODEL_UNSUPPORTED: {
    code: 'BOTS_010',
    message: 'That model cannot run a bot',
    httpStatus: 422,
  },
} as const satisfies Record<string, ErrorDefinition>;
