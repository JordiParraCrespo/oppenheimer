import { applyDecorators } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';

/**
 * The problems every organization route can answer with, documented once for
 * the use-case controllers under `/organizations` that act on organizations.
 */
export const OrganizationProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 404,
      description: 'The organization does not exist, or is not visible to the caller',
      code: 'ORG_001',
    }),
    ApiProblemResponse({
      status: 502,
      description: 'The organization service failed to handle the request',
      code: 'ORG_016',
    }),
    ApiProblemResponse({
      status: 403,
      description:
        'The caller is not a member of the organization, or their org role does not allow this',
      code: ['ORG_003', 'ORG_004'],
    }),
    ApiProblemResponse({
      status: 409,
      description: 'The slug is taken, or an organization limit has been reached',
      code: ['ORG_002', 'ORG_014'],
    }),
  );
