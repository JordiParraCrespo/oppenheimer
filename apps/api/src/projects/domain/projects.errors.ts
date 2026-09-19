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
} as const satisfies Record<string, ErrorDefinition>;
