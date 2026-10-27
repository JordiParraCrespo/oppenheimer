import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const InboxErrors = {
  /** A mark is a person's in a workspace, and the request acts in none. */
  NO_ACTIVE_ORGANIZATION: {
    code: 'INBOX_001',
    message: 'The Inbox belongs to a workspace',
    httpStatus: 400,
  },
  /** The path's key is not `<kind>:<id>` in the characters a key may hold. */
  INVALID_ITEM_KEY: {
    code: 'INBOX_002',
    message: 'Not an Inbox item key',
    httpStatus: 400,
  },
  /** A snooze whose end is now or already past would hide nothing. */
  SNOOZE_NOT_IN_FUTURE: {
    code: 'INBOX_003',
    message: 'A snooze ends in the future',
    httpStatus: 422,
  },
  /** No mark on that occurrence: never set, or removed meanwhile. */
  MARK_NOT_FOUND: {
    code: 'INBOX_004',
    message: 'Inbox mark not found',
    httpStatus: 404,
  },
} as const satisfies Record<string, ErrorDefinition>;
