import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the automations module, used only when the API
 * could not be reached or answered with something that is not a problem
 * document. A refusal the API explains (`AUTOMATIONS_*`) reaches the screen
 * with its own code.
 */
export const AutomationsErrors = {
  FETCH_LIST_FAILED: { code: 'AUTOMATIONS_CLIENT_001', message: 'Failed to load automations' },
  FETCH_FAILED: { code: 'AUTOMATIONS_CLIENT_002', message: 'Failed to load the automation' },
  SAVE_FAILED: { code: 'AUTOMATIONS_CLIENT_003', message: 'Failed to save the automation' },
  ACTION_FAILED: { code: 'AUTOMATIONS_CLIENT_004', message: 'Failed to update the automation' },
  DELETE_FAILED: { code: 'AUTOMATIONS_CLIENT_005', message: 'Failed to delete the automation' },
  RUN_FAILED: { code: 'AUTOMATIONS_CLIENT_006', message: 'Failed to start the run' },
  FETCH_RUNS_FAILED: { code: 'AUTOMATIONS_CLIENT_007', message: 'Failed to load runs' },
  FETCH_HISTORY_FAILED: { code: 'AUTOMATIONS_CLIENT_008', message: 'Failed to load run history' },
  PREVIEW_FAILED: { code: 'AUTOMATIONS_CLIENT_009', message: 'Failed to preview the trigger' },
} as const satisfies Record<string, ErrorDefinition>;
