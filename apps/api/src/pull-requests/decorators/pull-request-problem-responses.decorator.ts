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
      description:
        'The installation, the repository or the pull request is not there, or none of your tokens opens the repository',
      code: ['GITHUB_001', 'GITHUB_010', 'GITHUB_013', 'GITHUB_023'],
    }),
    ApiProblemResponse({
      status: 409,
      description: 'The installation is suspended or no longer installed',
      code: 'GITHUB_008',
    }),
    ApiProblemResponse({
      status: 429,
      description: "GitHub's rate limit was reached; try again after Retry-After",
      code: 'GITHUB_015',
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

/**
 * What a write in the caller's name adds: no user token, GitHub would not
 * merge yet, or the repository is read through the caller's own token.
 */
export const PullRequestWriteProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 409,
      description:
        'No GitHub user token to act with, GitHub would not merge yet, or the repository is read through your own token',
      code: ['GITHUB_012', 'GITHUB_014', 'GITHUB_022'],
    }),
  );
