import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the sessions module, used only when the API could
 * not be reached or answered with something that is not a problem document.
 */
export const SessionsErrors = {
  FETCH_LIST_FAILED: {
    code: 'SESSIONS_CLIENT_001',
    message: 'Failed to load sessions',
  },
  FETCH_ONE_FAILED: {
    code: 'SESSIONS_CLIENT_002',
    message: 'Failed to load the session',
  },
  CREATE_FAILED: {
    code: 'SESSIONS_CLIENT_003',
    message: 'Failed to start the session',
  },
  STOP_FAILED: {
    code: 'SESSIONS_CLIENT_004',
    message: 'Failed to stop the session',
  },
  ATTACH_TICKET_FAILED: {
    code: 'SESSIONS_CLIENT_005',
    message: 'Failed to open the terminal',
  },
  FETCH_EVENTS_FAILED: {
    code: 'SESSIONS_CLIENT_006',
    message: "Failed to load the session's progress",
  },
  PASTE_IMAGE_FAILED: {
    code: 'SESSIONS_CLIENT_007',
    message: 'Failed to give the image to the session',
  },
  /**
   * The API's own code for an image over the cap, raised here before the
   * upload: a file that would be refused is not worth sending, and the reader
   * sees the same words either way.
   */
  IMAGE_TOO_LARGE: {
    code: 'SESSIONS_012',
    message: 'That image is too large to give the session',
  },
} as const satisfies Record<string, ErrorDefinition>;
