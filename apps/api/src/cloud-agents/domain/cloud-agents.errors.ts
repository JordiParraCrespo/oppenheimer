import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * `CLOUD_AGENTS_001`, `008` and `009` are retired: an agent that is not found,
 * busy or already stopped were the codes of the agent's own page, which is a
 * cloud session's at its vendor now (`product/next-steps/cloud-agents.md`).
 */
export const CloudAgentErrors = {
  /** No `CLOUD_AGENTS_KEY` on this server, so no vendor key can be kept. */
  NOT_CONFIGURED: {
    code: 'CLOUD_AGENTS_003',
    message: 'Cloud agents are not configured on this server',
    httpStatus: 503,
  },
  /** The caller has stored no key for that vendor: connect it first. */
  NOT_CONNECTED: {
    code: 'CLOUD_AGENTS_004',
    message: 'That cloud agent provider is not connected',
    httpStatus: 409,
  },
  /** The vendor refused the key: wrong, revoked, or a kind it does not take here. */
  KEY_REFUSED: {
    code: 'CLOUD_AGENTS_005',
    message: 'The provider refused the API key',
    httpStatus: 422,
  },
  /** The vendor answered with an error, or did not answer. */
  PROVIDER_UNAVAILABLE: {
    code: 'CLOUD_AGENTS_006',
    message: 'The cloud agent provider did not answer',
    httpStatus: 502,
  },
  /** The vendor's rate limit, or calls queued past what this server waits for. */
  RATE_LIMITED: {
    code: 'CLOUD_AGENTS_007',
    message: 'The cloud agent provider’s rate limit was reached',
    httpStatus: 429,
  },
  /**
   * The vendor refused the launch as asked: a repository it
   * cannot reach, a model it does not offer, a feature the account lacks. The
   * detail carries the vendor's own words.
   */
  REQUEST_REFUSED: {
    code: 'CLOUD_AGENTS_010',
    message: 'The cloud agent provider refused the request',
    httpStatus: 422,
  },
  /** A provider this server does not offer. */
  PROVIDER_NOT_FOUND: {
    code: 'CLOUD_AGENTS_011',
    message: 'No such cloud agent provider',
    httpStatus: 404,
  },
} as const satisfies Record<string, ErrorDefinition>;
