import { applyDecorators } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';

/**
 * The problems every admin route can answer with, documented once and carried
 * by each admin controller: any call into the admin plugin can be refused for
 * the same reasons (the account is gone, the caller may not do this to it, the
 * plugin rejected or failed it).
 */
export const AdminProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 404,
      description: 'The user does not exist',
      code: 'ADMIN_001',
    }),
    ApiProblemResponse({
      status: 403,
      description:
        'The account may not perform this administrative action, it targets the caller themselves, or the target is banned',
      code: ['ADMIN_003', 'ADMIN_004', 'ADMIN_006'],
    }),
    ApiProblemResponse({
      status: 409,
      description: 'A user with that email already exists',
      code: 'ADMIN_002',
    }),
    ApiProblemResponse({
      status: 400,
      description: 'The role is not assignable, or the request was otherwise rejected',
      code: ['ADMIN_005', 'ADMIN_007'],
    }),
    ApiProblemResponse({
      status: 502,
      description: 'The admin service failed to handle the request',
      code: 'ADMIN_008',
    }),
  );
