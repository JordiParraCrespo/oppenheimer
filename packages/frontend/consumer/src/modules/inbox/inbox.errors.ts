import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the Inbox's marks, used only when the API could
 * not be reached or answered with something that is not a problem document.
 */
export const InboxErrors = {
  FETCH_MARKS_FAILED: { code: 'INBOX_CLIENT_001', message: 'Failed to load the Inbox' },
  PUT_MARK_FAILED: { code: 'INBOX_CLIENT_002', message: 'Failed to save that' },
  DELETE_MARK_FAILED: { code: 'INBOX_CLIENT_003', message: 'Failed to bring that back' },
} as const satisfies Record<string, ErrorDefinition>;
