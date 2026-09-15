import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const AccessGrantErrors = {
  NOT_FOUND: {
    code: 'GRANT_001',
    message: 'Access grant not found',
    httpStatus: 404,
  },
  /**
   * The containment rule: a grant cannot hand out reach its author lacks.
   * `resourceId: null` ("every row of this type") is the strongest thing the
   * table can express, so only an existing holder of it may mint one.
   */
  NOT_GRANTABLE: {
    code: 'GRANT_002',
    message: "An access grant cannot exceed the granter's own access",
    httpStatus: 403,
  },
  PRINCIPAL_OUTSIDE_ORGANIZATION: {
    code: 'GRANT_003',
    message: 'The named principal does not belong to this organization',
    httpStatus: 400,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'GRANT_004',
    message: 'Access grants are written inside an organization',
    httpStatus: 400,
  },
} as const satisfies Record<string, ErrorDefinition>;
