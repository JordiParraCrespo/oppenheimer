import { applyDecorators } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';

export const WorkspaceProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 404,
      description: 'The workspace, its organization, or the member does not exist',
      code: ['ORG_012', 'ORG_001', 'ORG_005'],
    }),
    ApiProblemResponse({
      status: 502,
      description: 'The organization service failed to handle the request',
      code: 'ORG_016',
    }),
    ApiProblemResponse({
      status: 403,
      description:
        'The caller is not a member, or their org role does not allow managing workspaces',
      code: ['ORG_003', 'ORG_004'],
    }),
    ApiProblemResponse({
      status: 409,
      description: 'A workspace with that name exists, or a workspace limit was reached',
      code: ['ORG_013', 'ORG_014'],
    }),
  );
