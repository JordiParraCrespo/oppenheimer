import { applyDecorators } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';

/** The problems every route that changes an organization's roster can answer with. */
export const MemberProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 404,
      description: 'The organization or the member does not exist',
      code: ['ORG_001', 'ORG_005'],
    }),
    ApiProblemResponse({
      status: 502,
      description: 'The organization service failed to handle the request',
      code: 'ORG_016',
    }),
    ApiProblemResponse({
      status: 403,
      description: 'The caller is not a member, or their org role does not allow managing members',
      code: ['ORG_003', 'ORG_004'],
    }),
    ApiProblemResponse({
      status: 409,
      description:
        'Already a member, the last owner cannot leave, or a membership limit was reached',
      code: ['ORG_006', 'ORG_007', 'ORG_014'],
    }),
  );
