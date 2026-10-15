import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the bots module, used only when the API could not
 * be reached or answered with something that is not a problem document. A
 * refusal the API explains (`BOTS_*`) reaches the screen with its own code.
 */
export const BotsErrors = {
  FETCH_LIST_FAILED: { code: 'BOTS_CLIENT_001', message: 'Failed to load bots' },
  FETCH_FAILED: { code: 'BOTS_CLIENT_002', message: 'Failed to load the bot' },
  SAVE_FAILED: { code: 'BOTS_CLIENT_003', message: 'Failed to save the bot' },
  DELETE_FAILED: { code: 'BOTS_CLIENT_004', message: 'Failed to delete the bot' },
  FETCH_GROUPS_FAILED: { code: 'BOTS_CLIENT_005', message: 'Failed to load bot groups' },
  SAVE_GROUP_FAILED: { code: 'BOTS_CLIENT_006', message: 'Failed to save the group' },
  DELETE_GROUP_FAILED: { code: 'BOTS_CLIENT_007', message: 'Failed to delete the group' },
  FETCH_DOCUMENTS_FAILED: { code: 'BOTS_CLIENT_008', message: 'Failed to load the instructions' },
  SAVE_DOCUMENT_FAILED: { code: 'BOTS_CLIENT_009', message: 'Failed to save the revision' },
  FETCH_REVISIONS_FAILED: { code: 'BOTS_CLIENT_010', message: 'Failed to load the revisions' },
  REVERT_FAILED: { code: 'BOTS_CLIENT_011', message: 'Failed to revert the document' },
  FETCH_MEMORY_FAILED: { code: 'BOTS_CLIENT_012', message: 'Failed to load the memory' },
  SAVE_FACT_FAILED: { code: 'BOTS_CLIENT_013', message: 'Failed to save the fact' },
  DELETE_FACT_FAILED: { code: 'BOTS_CLIENT_014', message: 'Failed to delete the fact' },
  CLEAR_MEMORY_FAILED: { code: 'BOTS_CLIENT_015', message: 'Failed to clear the memory' },
  FETCH_PROVIDERS_FAILED: {
    code: 'BOTS_CLIENT_016',
    message: 'Failed to load the model providers',
  },
  SAVE_PROVIDER_KEY_FAILED: { code: 'BOTS_CLIENT_017', message: 'Failed to save the key' },
  DELETE_PROVIDER_KEY_FAILED: { code: 'BOTS_CLIENT_018', message: 'Failed to remove the key' },
} as const satisfies Record<string, ErrorDefinition>;
