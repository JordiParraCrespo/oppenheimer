import { applyDecorators } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';

/**
 * What every Pull requests route can answer with: it reads GitHub through the
 * workspace's installations, so it can be refused for the installation's
 * reasons and for GitHub's.
 */
export const PullRequestProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({ status: 400, description: 'No active workspace', code: 'PULLS_001' }),
    ApiProblemResponse({
      status: 404,
      description: 'The installation, the repository or the pull request is not there',
      code: ['GITHUB_001', 'GITHUB_010', 'GITHUB_013'],
    }),
    ApiProblemResponse({
      status: 409,
      description: 'The installation is suspended or no longer installed',
      code: 'GITHUB_008',
    }),
    ApiProblemResponse({
      status: 502,
      description: 'GitHub could not be reached or rejected the request',
      code: 'GITHUB_009',
    }),
    ApiProblemResponse({
      status: 503,
      description: 'The GitHub App is not configured on this server',
      code: 'GITHUB_002',
    }),
    ApiProblemResponse({
      status: 429,
      description: 'GitHub asked to wait; `retryAfterSeconds` says how long',
      code: 'GITHUB_015',
    }),
  );

/** What a write in the caller's name adds: no user token, or GitHub would not merge yet. */
export const PullRequestWriteProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 409,
      description: 'No GitHub user token to act with, or GitHub would not merge yet',
      code: ['GITHUB_012', 'GITHUB_014'],
    }),
  );
