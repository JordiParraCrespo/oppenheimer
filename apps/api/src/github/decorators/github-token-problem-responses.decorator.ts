import { applyDecorators } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';

/** What every GitHub token route can answer with beyond authentication. */
export const GithubTokenProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 404,
      description: 'No such token of yours',
      code: 'GITHUB_019',
    }),
    ApiProblemResponse({
      status: 503,
      description: 'This server has no key to keep GitHub tokens with',
      code: 'GITHUB_021',
    }),
  );

/** What asking GitHub about a token adds: GitHub refused it, or asked to wait, or failed. */
export const GithubTokenCheckProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 422,
      description: 'GitHub did not accept the token',
      code: 'GITHUB_018',
    }),
    ApiProblemResponse({
      status: 429,
      description: 'GitHub asked to wait; `retryAfterSeconds` says how long',
      code: 'GITHUB_015',
    }),
    ApiProblemResponse({
      status: 502,
      description: 'GitHub could not be reached or rejected the request',
      code: 'GITHUB_009',
    }),
  );
