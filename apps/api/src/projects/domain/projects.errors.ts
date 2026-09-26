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
   * Archiving has to refuse while work is still going on inside the project's
   * directory, and the question "is any session still open here" is answered by
   * the module that owns sessions, over the query bus. If nothing answers it,
   * archiving refuses: a destructive path that assumes "no work" when it cannot
   * ask is fail-open, and this is the fail-closed half of that.
   */
  ARCHIVE_UNAVAILABLE: {
    code: 'PROJECTS_003',
    message: 'Projects cannot be archived right now',
    httpStatus: 503,
  },
  /** Sessions cannot be started in a retired project: its directory is out of use. */
  ARCHIVED: {
    code: 'PROJECTS_004',
    message: 'That project is archived',
    httpStatus: 409,
  },
  /** Archiving refuses while the project still holds sessions nobody has closed. */
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
   * Every candidate directory name was taken. The last candidate carries the
   * project's own id, so this is a bug or a collision nobody should ever see, and
   * it is reported rather than retried.
   */
  SLUG_UNAVAILABLE: {
    code: 'PROJECTS_007',
    message: 'No directory name is free for that project',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
