import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * The sessions catalog.
 *
 * The prefix is plural because the Go runner owns `SESS_00x` in the same
 * `apps/docs/docs/errors.md` and a code may only be claimed once.
 *
 * Nothing here says whether a session exists in another workspace, and nothing
 * says which of a checkout's two ids was the one GitHub refused: both answers
 * would turn a refusal into a way of reading rows the caller cannot see.
 */
export const SessionErrors = {
  /**
   * Also raised for a session that exists but sits in another workspace: the
   * scoped read cannot see it, and distinguishing the two would confirm the id.
   */
  NOT_FOUND: {
    code: 'SESSIONS_001',
    message: 'Session not found',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'SESSIONS_002',
    message: 'Sessions belong to an organization',
    httpStatus: 400,
  },
  CHECKOUT_NOT_FOUND: {
    code: 'SESSIONS_003',
    message: 'Checkout not found on this session',
    httpStatus: 404,
  },
  /**
   * A repository this session already holds. The directory name inside a session
   * is never reused, so the second checkout of one repository is a request that
   * cannot be satisfied rather than one that silently overwrites the first.
   */
  CHECKOUT_ALREADY_PRESENT: {
    code: 'SESSIONS_004',
    message: 'That repository is already checked out for this session',
    httpStatus: 409,
  },
  /**
   * Raised on a stop, restart, rename or checkout change against a session that
   * has already been closed. Closing is final: the row stays for ever so its
   * directory name and branch are never reissued, which is exactly why it cannot
   * be reopened.
   */
  ALREADY_RESOLVED: {
    code: 'SESSIONS_005',
    message: 'That session is closed',
    httpStatus: 409,
  },
  /** The project a session was asked for is retired; its directory is out of use. */
  PROJECT_ARCHIVED: {
    code: 'SESSIONS_006',
    message: 'That project is archived',
    httpStatus: 409,
  },
  /**
   * The event's payload is over the wire cap. The limit is the protocol's, so a
   * runner generated from the same schema refuses it before sending — this is the
   * control plane holding the same line for anything that does not.
   */
  EVENT_PAYLOAD_TOO_LARGE: {
    code: 'SESSIONS_007',
    message: 'That session event payload is too large',
    httpStatus: 400,
  },
  /**
   * The attach ticket could not be claimed. A ticket is a single-use key in a
   * shared cache; a collision means the random id was already taken, which is a
   * server fault rather than a caller's.
   */
  /**
   * A session with no checkouts and no project named. Zero checkouts is a real
   * session — a project of notes and documents needs no git at all — but then
   * nothing says which project's directory it belongs in, and the project cannot
   * be derived from a repository that was not asked for.
   */
  PROJECT_REQUIRED: {
    code: 'SESSIONS_009',
    message: 'A session with no repositories must name its project',
    httpStatus: 400,
  },
  ATTACH_TICKET_UNAVAILABLE: {
    code: 'SESSIONS_008',
    message: 'A terminal ticket could not be issued',
    httpStatus: 503,
  },
} as const satisfies Record<string, ErrorDefinition>;
