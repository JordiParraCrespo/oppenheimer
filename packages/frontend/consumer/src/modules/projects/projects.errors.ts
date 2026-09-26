import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the projects module, used only when the API could
 * not be reached or answered with something that is not a problem document.
 */
export const ProjectsErrors = {
  FETCH_LIST_FAILED: {
    code: 'PROJECTS_CLIENT_001',
    message: 'Failed to load projects',
  },
  CREATE_FAILED: {
    code: 'PROJECTS_CLIENT_002',
    message: 'Failed to create the project',
  },
  UPDATE_FAILED: {
    code: 'PROJECTS_CLIENT_003',
    message: 'Failed to save the project',
  },
  ARCHIVE_FAILED: {
    code: 'PROJECTS_CLIENT_004',
    message: 'Failed to delete the project',
  },
} as const satisfies Record<string, ErrorDefinition>;
