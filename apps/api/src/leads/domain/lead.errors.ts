import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const LeadErrors = {
  /**
   * Also raised for a lead that exists but sits outside the caller's scope.
   * Distinguishing the two would confirm the id, which is the probing oracle
   * the api-token module already avoids.
   */
  NOT_FOUND: {
    code: 'LEAD_001',
    message: 'Lead not found',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'LEAD_002',
    message: 'Leads are created inside an organization',
    httpStatus: 400,
  },
} as const satisfies Record<string, ErrorDefinition>;
