import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * The hosts catalog.
 *
 * The prefix is plural because the Go runner owns `HOST_00x` and `PAIR_00x` in
 * the same `apps/docs/docs/errors.md`, and a code may only be claimed once.
 *
 * Two entries are deliberately opaque. A rejected registration token does not
 * say whether it was used, expired, revoked or never real, and a rejected host
 * assertion does not say whether the signature, the audience, the expiry or the
 * replay guard refused it: each of those answers would turn the endpoint into an
 * oracle for guessing the credential.
 */
export const HostErrors = {
  /**
   * Also raised for a host that exists but sits outside the caller's access
   * scope — the scoped read cannot see it, and distinguishing the two would
   * confirm the id.
   */
  NOT_FOUND: {
    code: 'HOSTS_001',
    message: 'Host not found',
    httpStatus: 404,
  },
  PAIRING_TOKEN_NOT_FOUND: {
    code: 'HOSTS_002',
    message: 'Pairing token not found',
    httpStatus: 404,
  },
  PAIRING_TOKEN_REJECTED: {
    code: 'HOSTS_003',
    message: 'The registration token was rejected',
    httpStatus: 401,
  },
  NOT_CONFIGURED: {
    code: 'HOSTS_004',
    message: 'Hosts are not configured on this server',
    httpStatus: 503,
  },
  ASSERTION_REJECTED: {
    code: 'HOSTS_005',
    message: 'The host assertion was rejected',
    httpStatus: 401,
  },
  /**
   * Every unspent token is a live way to add a machine to the account for an
   * hour, so one person may hold only a few at once.
   */
  TOO_MANY_PAIRING_TOKENS: {
    code: 'HOSTS_006',
    message: 'Too many pairing tokens are open',
    httpStatus: 429,
  },
  /**
   * No image is parked for that command for this host: it was already
   * pulled, it expired, or it was parked for another host — the three are one
   * answer, so the route cannot be used to probe which.
   */
  IMAGE_NOT_PARKED: {
    code: 'HOSTS_007',
    message: 'No image is waiting for that command',
    httpStatus: 404,
  },
} as const satisfies Record<string, ErrorDefinition>;
