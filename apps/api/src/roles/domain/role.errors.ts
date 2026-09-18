import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Role domain error catalog. Surfaced as HTTP responses by the global
 * `AllExceptionsFilter` via `AppError`.
 */
export const RoleErrors = {
  NOT_FOUND: {
    code: 'ROLE_001',
    message: 'Role not found',
    httpStatus: 404,
  },
  NAME_TAKEN: {
    code: 'ROLE_002',
    message: 'A role with this name already exists',
    httpStatus: 409,
  },
  SYSTEM_ROLE_IMMUTABLE: {
    code: 'ROLE_003',
    message: 'System roles cannot be deleted or renamed',
    httpStatus: 403,
  },
  ADMIN_LOCKOUT: {
    code: 'ROLE_004',
    message:
      'A system role that grants full access ("manage all") cannot have that permission removed',
    httpStatus: 403,
  },
  /**
   * No privilege escalation: a role cannot be given reach its author lacks.
   * Without this, anyone who can edit roles can write themselves `manage all`.
   */
  PERMISSION_NOT_GRANTABLE: {
    code: 'ROLE_005',
    message: 'A role cannot be granted permissions its author does not hold',
    httpStatus: 403,
  },
  CROSS_ORGANIZATION_ROLE: {
    code: 'ROLE_006',
    message: 'A role belonging to another organization cannot be modified',
    httpStatus: 403,
  },
  /**
   * A system role the code depends on is not in the database — the migrations
   * install them, so this means the deployment is behind the code.
   *
   * Distinct from `NOT_FOUND`, and deliberately a 500: `NOT_FOUND` is "the role
   * you named does not exist", something the caller got wrong and can fix. This
   * is the platform missing a role nobody named, which no request can act on.
   * Every path that needs one — sign-up's default `user` grant, the org-scoped
   * `owner` grant on both the provisioning and the hand-create paths — raises
   * this one entry, so a single fault has a single shape.
   */
  SYSTEM_ROLE_MISSING: {
    code: 'ROLE_007',
    message: 'A system role this deployment needs is not installed',
    httpStatus: 500,
  },
} as const satisfies Record<string, ErrorDefinition>;
