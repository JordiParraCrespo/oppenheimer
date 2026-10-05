import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const ProjectErrors = {
  /**
   * Also raised for a project that exists but sits in another workspace: the
   * scoped read cannot see it, and distinguishing the two would confirm the id.
   */
  NOT_FOUND: {
    code: 'PROJECTS_001',
    message: 'Project not found',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'PROJECTS_002',
    message: 'Projects belong to an organization',
    httpStatus: 400,
  },
  /**
   * No module contributed an answer to "is any session still open here", so
   * archiving refuses rather than assume there is none (fail-closed).
   */
  ARCHIVE_UNAVAILABLE: {
    code: 'PROJECTS_003',
    message: 'Projects cannot be archived right now',
    httpStatus: 503,
  },
  /** Nothing new goes into a retired project. */
  ARCHIVED: {
    code: 'PROJECTS_004',
    message: 'That project is archived',
    httpStatus: 409,
  },
  HAS_OPEN_SESSIONS: {
    code: 'PROJECTS_005',
    message: 'That project still has open sessions',
    httpStatus: 409,
  },
  /**
   * A repository list a project cannot hold: none at all, none offered by default,
   * one repository twice, more than twenty, or a blank base branch. The detail
   * names which. The shared schema refuses the same bodies earlier; this is the
   * aggregate holding its invariants whatever the caller.
   */
  INVALID_REPOSITORIES: {
    code: 'PROJECTS_006',
    message: 'A project needs at least one repository, one of them a default',
    httpStatus: 400,
  },
  /**
   * Every candidate slug was taken. The last candidate carries the project's own
   * id, so this is a bug or a collision nobody should ever see, and it is
   * reported rather than retried.
   */
  SLUG_UNAVAILABLE: {
    code: 'PROJECTS_007',
    message: 'No slug is free for that project',
    httpStatus: 409,
  },
  /**
   * The Unassigned project is where a session that names no project is listed,
   * one per workspace. Renaming or archiving it would leave that work nowhere to
   * go, so both are refused; its repositories and defaults can still be edited.
   */
  UNASSIGNED_FIXED: {
    code: 'PROJECTS_008',
    message: 'The Unassigned project cannot be renamed or archived',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
