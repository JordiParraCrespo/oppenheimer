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
  /**
   * Archiving retires a directory name on every host holding the project, so it
   * waits for the sessions inside it to be closed.
   */
  HAS_OPEN_SESSIONS: {
    code: 'PROJECTS_002',
    message: 'This project still has open sessions',
    httpStatus: 409,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'PROJECTS_003',
    message: 'Projects belong to an organization',
    httpStatus: 400,
  },
  /**
   * Every candidate slug was held by a project with a different origin. The
   * first candidate is the repository's own name and the rest carry a random
   * suffix, so this is a retryable fault rather than anything the caller said.
   */
  SLUG_UNAVAILABLE: {
    code: 'PROJECTS_004',
    message: 'Could not reserve a directory name for this project',
    httpStatus: 503,
  },
} as const satisfies Record<string, ErrorDefinition>;
