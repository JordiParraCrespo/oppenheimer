import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
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
   * Raised on more work for a session that has already been closed: a stop,
   * restart, rename, move, added checkout, terminal ticket or input. Closing is
   * final: the row is a tombstone that keeps its directory name and branch from
   * being reissued.
   */
  ALREADY_RESOLVED: {
    code: 'SESSIONS_005',
    message: 'That session is closed',
    httpStatus: 409,
  },
  /** The project a session was asked for is retired: nothing new is listed under it. */
  PROJECT_ARCHIVED: {
    code: 'SESSIONS_006',
    message: 'That project is archived',
    httpStatus: 409,
  },
  /**
   * Every directory name this repository can take inside this session is spent.
   * The three candidates are derived from the repository and a spent name is never
   * reissued, so the honest answer is a refusal: reusing one would put a fresh
   * agent in a retired agent's working directory.
   */
  CHECKOUT_NAMES_EXHAUSTED: {
    code: 'SESSIONS_007',
    message: 'That repository has used every directory name it can take here',
    httpStatus: 409,
  },
  /**
   * The attach ticket could not be claimed. A ticket is a single-use key in a
   * shared cache; a collision means the random id was already taken, which is a
   * server fault rather than a caller's.
   */
  ATTACH_TICKET_UNAVAILABLE: {
    code: 'SESSIONS_008',
    message: 'A terminal ticket could not be issued',
    httpStatus: 503,
  },
  /**
   * A repository added to a session that already checks out one. The runner
   * makes a worktree (and keeps a clone) per checkout, at create only: a create
   * takes up to `MAX_SESSION_CHECKOUTS`, capped by its schema, and the wire has
   * no frame that adds one to a running session, so a later add is refused
   * before a row is written rather than recorded and never made. The code dates
   * from the one-repository MVP (#56); the create bound was raised on 2026-10-26.
   */
  TOO_MANY_REPOSITORIES: {
    code: 'SESSIONS_010',
    message: 'A running session keeps the repositories it was created with',
    httpStatus: 409,
  },
  /**
   * An agent the host's runner was built without (`runnerRefusal`). Refused
   * before a row is written, rather than recorded and then failed by the host.
   */
  AGENT_UNSUPPORTED_BY_RUNNER: {
    code: 'SESSIONS_011',
    message: "This host's runner cannot start that agent",
    httpStatus: 409,
  },
  /** An upload over `SESSION_FILE_MAX_BYTES`, refused by multer before it is buffered. */
  FILE_TOO_LARGE: {
    code: 'SESSIONS_012',
    message: 'That file is too large to give the session',
    httpStatus: 413,
  },
  /**
   * Bytes that are none of the types a session takes (the images, PDF, UTF-8
   * text that is not a script or markup), whatever their label or name.
   */
  UNSUPPORTED_FILE: {
    code: 'SESSIONS_013',
    message: 'That is not a file the session can take',
    httpStatus: 415,
  },
  /**
   * Input for a session whose tmux session is gone. Whatever it was would be
   * sent to a window that is not there, so it is refused before it is sent.
   */
  NOT_RUNNING: {
    code: 'SESSIONS_014',
    message: 'That session is stopped',
    httpStatus: 409,
  },
  /** A multipart request with no file part: nothing to judge. */
  FILE_MISSING: {
    code: 'SESSIONS_015',
    message: 'No file was attached',
    httpStatus: 400,
  },
  /**
   * The host holds no link right now: a paste into a session on it, or a
   * create carrying files for it. Neither is queued for a host that comes
   * back — the prompt moves on, and the files expire.
   */
  HOST_OFFLINE: {
    code: 'SESSIONS_016',
    message: 'The host is offline',
    httpStatus: 503,
  },
  /**
   * The host is linked but its runner did not say it takes this file — pasted
   * into a session or attached to a first task: no files at all
   * (`session.image`, `session.create.images`), or images only, not PDF or
   * text (`session.files`). It predates them, and updating the runner is
   * what fixes it.
   */
  HOST_CANNOT_TAKE_FILE: {
    code: 'SESSIONS_017',
    message: 'The host cannot take that file until its runner is updated',
    httpStatus: 409,
  },
  /**
   * A create names an attachment that is not waiting for this person: it
   * expired, it was already used, or it was never theirs. The three are one
   * answer, so an id cannot be probed.
   */
  ATTACHMENT_NOT_FOUND: {
    code: 'SESSIONS_019',
    message: 'An attached file is no longer waiting',
    httpStatus: 410,
  },
  /**
   * One person already has as many uploads waiting as they may. Each is up to
   * 5 MB in the cache that also backs sign-in, so the cap is on what is held.
   */
  TOO_MANY_ATTACHMENTS: {
    code: 'SESSIONS_020',
    message: 'Too many files are waiting to be sent',
    httpStatus: 429,
  },
  /**
   * A share that opens nothing: the session was never shared at that
   * address, its owner stopped sharing it, it expired, or the session closed.
   * One answer for all of them, so a guest learns nothing from an address
   * that no longer works.
   */
  SHARE_NOT_FOUND: {
    code: 'SESSIONS_021',
    message: 'That session is not shared, or no longer',
    httpStatus: 404,
  },
  /** Opening a shared session needs an account, and nobody is signed in. */
  SHARE_SIGN_IN_REQUIRED: {
    code: 'SESSIONS_022',
    message: 'Sign in to open this shared session',
    httpStatus: 401,
  },
  /** Signed in, and not one of the people the share names (or the email is unverified). */
  SHARE_NOT_INVITED: {
    code: 'SESSIONS_023',
    message: 'This session is not shared with you',
    httpStatus: 403,
  },
  /**
   * A folder session for a host whose live runner did not say it takes one
   * (`session.folder`): it would refuse a create with no checkouts. Updating
   * the runner fixes it. An offline host is not refused: its next hello is
   * sent the session, and a runner that still cannot take it leaves it
   * starting.
   */
  FOLDER_UNSUPPORTED_BY_RUNNER: {
    code: 'SESSIONS_025',
    message: "This host's runner cannot start a session in a folder",
    httpStatus: 409,
  },
  /** The folder picker asked a host whose runner does not list folders (`fs.list`). */
  FOLDERS_UNSUPPORTED_BY_RUNNER: {
    code: 'SESSIONS_026',
    message: "This host's runner cannot list its folders",
    httpStatus: 409,
  },
  /** The folder picker asked a host that holds no link: nothing is cached to answer from. */
  FOLDERS_HOST_OFFLINE: {
    code: 'SESSIONS_027',
    message: 'The host is offline, so its folders cannot be listed',
    httpStatus: 503,
  },
  /** The runner found nothing at that path (`FS_001`). */
  FOLDER_NOT_FOUND: {
    code: 'SESSIONS_028',
    message: 'That folder does not exist on the host',
    httpStatus: 404,
  },
  /** The path names a file, not a directory (`FS_002`). */
  NOT_A_FOLDER: {
    code: 'SESSIONS_029',
    message: 'That path is not a folder',
    httpStatus: 422,
  },
  /** The user the runner runs as may not read that folder (`FS_003`), or it failed otherwise. */
  FOLDER_NOT_READABLE: {
    code: 'SESSIONS_030',
    message: 'That folder cannot be read on the host',
    httpStatus: 403,
  },
  /** The runner did not answer the listing in time. */
  FOLDERS_TIMED_OUT: {
    code: 'SESSIONS_031',
    message: 'The host did not answer in time',
    httpStatus: 504,
  },
  /**
   * An answer to a decision the session no longer waits on: somebody answered
   * it already (here or at the terminal), or the agent asked something else.
   * The answer names the decision it was for, so it never lands on another.
   */
  DECISION_STALE: {
    code: 'SESSIONS_032',
    message: 'That question was already answered or changed',
    httpStatus: 409,
  },
  /**
   * An answer that does not fit the pending decision: an option it does not
   * have, several picks for one choice, none at all, or answers for the
   * wrong number of questions.
   */
  DECISION_ANSWER_INVALID: {
    code: 'SESSIONS_033',
    message: 'That answer does not fit the question',
    httpStatus: 422,
  },
  /** The host holds no link, so the keys that answer a decision were not sent. */
  DECISION_HOST_OFFLINE: {
    code: 'SESSIONS_034',
    message: 'The host is offline, so the answer was not sent',
    httpStatus: 503,
  },
  /** No preview domain (`PREVIEW_BASE_URL`): this deployment cannot serve a session's ports. */
  PREVIEWS_NOT_CONFIGURED: {
    code: 'SESSIONS_035',
    message: 'Previews are not configured on this server',
    httpStatus: 501,
  },
} as const satisfies Record<string, ErrorDefinition>;
