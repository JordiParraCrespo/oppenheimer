import { applyDecorators } from '@nestjs/common';
import { ApiProblemResponse } from '@oppenheimer/backend-core';

/**
 * What a prompt to a cloud session can be refused for
 * (`product/next-steps/cloud-agents.md`, "Follow-ups to a cloud agent"): one a
 * host started takes input at its vendor, and one a vendor runs through its
 * API takes it as a new run, on its launcher's key, once its last run ended.
 */
export const CloudFollowUpProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse({
      status: 409,
      description: 'A Claude Code or Codex cloud session takes input at its vendor',
      code: 'SESSIONS_038',
    }),
    ApiProblemResponse({
      status: 403,
      description: 'Only the person who launched a cloud session can follow it up',
      code: 'SESSIONS_050',
    }),
    ApiProblemResponse({
      status: 409,
      description: 'The cloud agent is still on its last run, or its launcher has no key stored',
      code: ['CLOUD_AGENTS_012', 'CLOUD_AGENTS_004'],
    }),
    ApiProblemResponse({
      status: 422,
      description: 'The vendor refused the key, or the follow-up as asked',
      code: ['CLOUD_AGENTS_005', 'CLOUD_AGENTS_010'],
    }),
    ApiProblemResponse({
      status: 429,
      description: "The vendor's rate limit was reached; try again after Retry-After",
      code: 'CLOUD_AGENTS_007',
    }),
    ApiProblemResponse({
      status: 502,
      description: 'The vendor did not answer',
      code: 'CLOUD_AGENTS_006',
    }),
  );
