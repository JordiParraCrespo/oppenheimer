import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const AutomationErrors = {
  /** Also raised for an automation in another workspace, or one that was deleted. */
  NOT_FOUND: {
    code: 'AUTOMATIONS_001',
    message: 'Automation not found',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'AUTOMATIONS_002',
    message: 'Automations belong to an organization',
    httpStatus: 400,
  },
  /** Somebody saved the automation since this editor loaded it. */
  VERSION_CONFLICT: {
    code: 'AUTOMATIONS_003',
    message: 'The automation was changed by someone else',
    httpStatus: 409,
  },
  /** A repository the workspace's installations do not reach, or the same one twice. */
  REPOSITORY_UNAVAILABLE: {
    code: 'AUTOMATIONS_004',
    message: 'A repository is not available to this workspace',
    httpStatus: 422,
  },
  /** The agent has no unattended mode, or no approvals to set a level on. */
  AGENT_UNSUPPORTED: {
    code: 'AUTOMATIONS_005',
    message: 'That agent cannot run an automation',
    httpStatus: 422,
  },
  /** A `once` trigger in the past, or a rule that never fires. */
  TRIGGER_NEVER_FIRES: {
    code: 'AUTOMATIONS_006',
    message: 'A trigger would never fire',
    httpStatus: 422,
  },
  /** An automation is set up for a project; the workspace's Unassigned project holds none. */
  PROJECT_UNAVAILABLE: {
    code: 'AUTOMATIONS_007',
    message: 'That project cannot hold automations',
    httpStatus: 422,
  },
  RUN_NOT_FOUND: {
    code: 'AUTOMATIONS_008',
    message: 'Run not found',
    httpStatus: 404,
  },
} as const satisfies Record<string, ErrorDefinition>;
