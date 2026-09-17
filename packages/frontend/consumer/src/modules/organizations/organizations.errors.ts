import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the organizations module. These are used only when
 * the API could not be reached, or answered with something that is not a
 * problem document — whenever the server sent one, `toAppError` keeps the
 * server's `code`, `title` and `detail` instead (see `ORG_*` in the API's error
 * reference).
 */
export const OrganizationsErrors = {
  FETCH_LIST_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_001',
    message: 'Failed to fetch organizations',
  },
  FETCH_MEMBERS_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_002',
    message: 'Failed to fetch organization members',
  },
  FETCH_INVITATIONS_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_003',
    message: 'Failed to fetch organization invitations',
  },
  INVITE_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_004',
    message: 'Failed to invite organization member',
  },
  UPDATE_MEMBER_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_005',
    message: 'Failed to update organization member',
  },
  REMOVE_MEMBER_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_006',
    message: 'Failed to remove organization member',
  },
  CANCEL_INVITATION_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_007',
    message: 'Failed to cancel organization invitation',
  },
  SET_ACTIVE_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_008',
    message: 'Failed to select organization',
  },
  UPDATE_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_009',
    message: 'Failed to update the organization',
  },
  ACCEPT_INVITATION_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_010',
    message: 'Failed to accept organization invitation',
  },
  FETCH_MY_INVITATIONS_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_011',
    message: 'Failed to fetch your invitations',
  },
  CREATE_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_012',
    message: 'Failed to create the organization',
  },
} as const satisfies Record<string, ErrorDefinition>;
