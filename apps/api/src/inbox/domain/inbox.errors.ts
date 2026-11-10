import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const InboxErrors = {
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
  /** No such report in the workspace, or no such picture on it. */
  REPORT_NOT_FOUND: {
    code: 'INBOX_005',
    message: 'Inbox report not found',
    httpStatus: 404,
  },
  /** A report takes one answer; a follow-up is a new report. */
  REPORT_ALREADY_ANSWERED: {
    code: 'INBOX_006',
    message: 'This report is already answered',
    httpStatus: 409,
  },
  TOO_MANY_REPORT_IMAGES: {
    code: 'INBOX_007',
    message: 'Too many pictures on one report',
    httpStatus: 422,
  },
  REPORT_IMAGE_TOO_LARGE: {
    code: 'INBOX_008',
    message: 'That picture is too large',
    httpStatus: 413,
  },
  /** Judged by the file's bytes, never by the type it was sent as. */
  REPORT_IMAGE_TYPE_UNSUPPORTED: {
    code: 'INBOX_009',
    message: 'A report takes PNG, JPEG, GIF or WebP pictures',
    httpStatus: 415,
  },
} as const satisfies Record<string, ErrorDefinition>;
