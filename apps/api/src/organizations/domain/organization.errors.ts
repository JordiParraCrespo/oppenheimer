import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * The distinctions a client branches on. Better Auth's ~60 organization codes
 * are grouped by the wording of an English sentence and change between
 * releases; `infrastructure/organization-error.util.ts` folds them onto these
 * and keeps the original as an `upstreamCode` extension member.
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
} as const satisfies Record<string, ErrorDefinition>;
