import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const CalendarErrors = {
  /** Also an event in another workspace. */
  EVENT_NOT_FOUND: {
    code: 'CALENDAR_001',
    message: 'Event not found',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'CALENDAR_002',
    message: 'The calendar belongs to an organization',
    httpStatus: 400,
  },
  /** A range that runs backwards or past the widest one read covers. */
  RANGE_TOO_WIDE: {
    code: 'CALENDAR_003',
    message: 'That range of days is too wide',
    httpStatus: 400,
  },
  /** No Google client or no sealing key on this server. */
  GOOGLE_NOT_CONFIGURED: {
    code: 'CALENDAR_004',
    message: 'Google Calendar is not configured on this server',
    httpStatus: 503,
  },
  /** The connect state was missing, expired, used, or someone else's. */
  GOOGLE_STATE_REJECTED: {
    code: 'CALENDAR_005',
    message: 'That Google Calendar connection was not started here',
    httpStatus: 400,
  },
  /**
   * Google refused the code, gave no refresh token, or the person left the
   * calendar permission unticked.
   */
  GOOGLE_GRANT_REFUSED: {
    code: 'CALENDAR_006',
    message: 'Google did not grant read access to the calendar',
    httpStatus: 400,
  },
  /** No connection, or Google revoked it: Connect again. */
  GOOGLE_NOT_CONNECTED: {
    code: 'CALENDAR_007',
    message: 'Google Calendar is not connected',
    httpStatus: 409,
  },
  /** Google answered with an error, or did not answer. */
  GOOGLE_UNAVAILABLE: {
    code: 'CALENDAR_008',
    message: 'Google Calendar did not answer',
    httpStatus: 502,
  },
  /** An event whose times do not fit its day: an end before its start, or times on an all-day event. */
  INVALID_TIMES: {
    code: 'CALENDAR_009',
    message: 'An event ends after it starts, on its day',
    httpStatus: 400,
  },
  /**
   * Google's quota stopped the read, or an earlier answer already said to wait.
   * A 429 with `Retry-After`; Google is not asked again until then.
   */
  GOOGLE_RATE_LIMITED: {
    code: 'CALENDAR_010',
    message: "Google Calendar's rate limit was reached; try again shortly",
    httpStatus: 429,
  },
} as const satisfies Record<string, ErrorDefinition>;
