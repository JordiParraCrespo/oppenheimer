import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the routines module, used only when the API could
 * not be reached or answered with something that is not a problem document.
 */
export const RoutinesErrors = {
  FETCH_LIST_FAILED: {
    code: 'ROUTINES_CLIENT_001',
    message: 'Failed to load automations',
  },
} as const satisfies Record<string, ErrorDefinition>;
