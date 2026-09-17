import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Organization / team / invitation error catalog. Surfaced as HTTP responses by
 * the global `AllExceptionsFilter` via `AppError`.
 *
 * Better Auth's organization plugin owns these tables and raises its own
 * `APIError`s with a `SCREAMING_SNAKE_CASE` code. Those codes are an upstream
 * detail: there are ~60 of them, they are grouped by the wording of the English
 * sentence rather than by what a client would do about them, and they change
 * between Better Auth releases. `organization-error.mapper.ts` folds them into
 * the entries below, which are the distinctions a client actually branches on.
 * The upstream code is preserved verbatim as an `upstreamCode` extension member
 * so nothing is lost for debugging.
 */
export const OrganizationErrors = {
  NOT_FOUND: {
    code: 'ORG_001',
    message: 'Organization not found',
    httpStatus: 404,
  },
  SLUG_TAKEN: {
    code: 'ORG_002',
    message: 'That organization slug is already taken',
    httpStatus: 409,
  },
  NOT_A_MEMBER: {
    code: 'ORG_003',
    message: 'You are not a member of this organization',
    httpStatus: 403,
  },
  INSUFFICIENT_ROLE: {
    code: 'ORG_004',
    message: 'Your role in this organization does not allow that',
    httpStatus: 403,
  },
  MEMBER_NOT_FOUND: {
    code: 'ORG_005',
    message: 'Member not found in this organization',
    httpStatus: 404,
  },
  ALREADY_A_MEMBER: {
    code: 'ORG_006',
    message: 'That user is already a member of this organization',
    httpStatus: 409,
  },
  LAST_OWNER: {
    code: 'ORG_007',
    message: 'An organization cannot be left without an owner',
    httpStatus: 409,
  },
  INVITATION_NOT_FOUND: {
    code: 'ORG_008',
    message: 'Invitation not found',
    httpStatus: 404,
  },
  INVITATION_NOT_FOR_YOU: {
    code: 'ORG_009',
    message: 'This invitation was issued to a different account',
    httpStatus: 403,
  },
  ALREADY_INVITED: {
    code: 'ORG_010',
    message: 'That user has already been invited to this organization',
    httpStatus: 409,
  },
  EMAIL_VERIFICATION_REQUIRED: {
    code: 'ORG_011',
    message: 'Verify your email address before acting on invitations',
    httpStatus: 403,
  },
  TEAM_NOT_FOUND: {
    code: 'ORG_012',
    message: 'Team not found',
    httpStatus: 404,
  },
  TEAM_ALREADY_EXISTS: {
    code: 'ORG_013',
    message: 'A team with that name already exists',
    httpStatus: 409,
  },
  LIMIT_REACHED: {
    code: 'ORG_014',
    message: 'A limit on this organization has been reached',
    httpStatus: 409,
  },
  REQUEST_REJECTED: {
    code: 'ORG_015',
    message: 'The organization service rejected this request',
    httpStatus: 400,
  },
  UPSTREAM_FAILED: {
    code: 'ORG_016',
    message: 'The organization service failed to handle this request',
    httpStatus: 502,
  },
  /**
   * Raised when provisioning a personal workspace finds no system `owner` role
   * to grant. The migration installs it, so this means the database is behind
   * the code — a deployment fault, not anything the caller did, which is why it
   * is a 500 rather than a 4xx the client could act on.
   */
  OWNER_ROLE_MISSING: {
    code: 'ORG_017',
    message: 'The system role that opens a workspace is not installed',
    httpStatus: 500,
  },
} as const satisfies Record<string, ErrorDefinition>;
