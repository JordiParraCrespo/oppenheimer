import { applyDecorators } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';

/** What issuing, answering or reading an invitation can be refused for, wherever it is addressed. */
const sharedInvitationProblems = [
  ApiProblemResponse({
    status: 403,
    description:
      'The invitation was issued to another account, the caller may not manage invitations, or their email is unverified',
    code: ['ORG_009', 'ORG_004', 'ORG_011'],
  }),
  ApiProblemResponse({
    status: 409,
    description:
      'That user is already invited or already a member, or an invitation limit was reached',
    code: ['ORG_010', 'ORG_006', 'ORG_014'],
  }),
  ApiProblemResponse({
    status: 502,
    description: 'The organization service failed to handle the request',
    code: 'ORG_016',
  }),
];

/** The routes under `/organizations/:orgId/invitations`, which name an organization. */
export const OrganizationInvitationProblemResponses = () =>
  applyDecorators(
    ...sharedInvitationProblems,
    ApiProblemResponse({
      status: 404,
      description: 'The organization does not exist, or is not visible to the caller',
      code: 'ORG_001',
    }),
  );

/** The routes under `/invitations`, which name an invitation. */
export const InvitationProblemResponses = () =>
  applyDecorators(
    ...sharedInvitationProblems,
    ApiProblemResponse({
      status: 404,
      description: 'The invitation does not exist or is no longer retrievable',
      code: 'ORG_008',
    }),
  );
