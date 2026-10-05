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
  ATTACH_TICKET_FAILED: {
    code: 'SESSIONS_CLIENT_005',
    message: 'Failed to open the terminal',
  },
  FETCH_EVENTS_FAILED: {
    code: 'SESSIONS_CLIENT_006',
    message: "Failed to load the session's progress",
  },
  PASTE_FILE_FAILED: {
    code: 'SESSIONS_CLIENT_007',
    message: 'Failed to give the file to the session',
  },
  RENAME_FAILED: {
    code: 'SESSIONS_CLIENT_008',
    message: 'Failed to rename the session',
  },
  MOVE_FAILED: {
    code: 'SESSIONS_CLIENT_009',
    message: 'Failed to move the session',
  },
  CLOSE_FAILED: {
    code: 'SESSIONS_CLIENT_010',
    message: 'Failed to delete the session',
  },
  UPLOAD_ATTACHMENT_FAILED: {
    code: 'SESSIONS_CLIENT_011',
    message: 'Failed to attach the file',
  },
  RESTART_FAILED: {
    code: 'SESSIONS_CLIENT_013',
    message: 'Failed to restart the session',
  },
  PREPARE_FAILED: {
    code: 'SESSIONS_CLIENT_014',
    message: 'Failed to get the host ready',
  },
  /**
   * The API's own code for a file over the cap, raised here before the
   * upload: a file that would be refused is not worth sending, and the reader
   * sees the same words either way.
   */
  FILE_TOO_LARGE: {
    code: 'SESSIONS_012',
    message: 'That file is too large to give the session',
  },
} as const satisfies Record<string, ErrorDefinition>;
