import { applyDecorators } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';

/** What every cloud agent route can be refused for before it reaches a vendor. */
export const CloudAgentProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 400,
      description: 'No active workspace',
      code: 'TENANT_001',
    }),
  );

/** What a route that calls the vendor can be refused for, on the caller's stored key. */
export const CloudAgentVendorProblemResponses = () =>
  applyDecorators(
    CloudAgentProblemResponses(),
    ApiProblemResponse({
      status: 409,
      description: 'The caller has no key stored for that provider',
      code: 'CLOUD_AGENTS_004',
    }),
    ApiProblemResponse({
      status: 422,
      description: 'The provider refused the stored key, or the request as asked',
      code: ['CLOUD_AGENTS_005', 'CLOUD_AGENTS_010'],
    }),
    ApiProblemResponse({
      status: 429,
      description: "The provider's rate limit was reached; try again after Retry-After",
      code: 'CLOUD_AGENTS_007',
    }),
    ApiProblemResponse({
      status: 502,
      description: 'The provider did not answer',
      code: 'CLOUD_AGENTS_006',
    }),
  );
