import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Failures the `github/` module can produce.
 *
 * The prefix is plural-noun `GITHUB_` and the numbering starts at 001 because
 * the Go runner owns its own `HOST_00x` / `PAIR_00x` / `SESS_00x` ranges in the
 * same catalog; a reused code fails `error-catalog-coverage.spec.ts`.
 */
export const GithubErrors = {
  /**
   * Also raised for an installation that exists but belongs to another
   * workspace, or one GitHub has told us was deleted. Distinguishing those
   * would confirm the id, which is the probing oracle the api-token module
   * already avoids.
   */
  INSTALLATION_NOT_FOUND: {
    code: 'GITHUB_001',
    message: 'GitHub installation not found',
    httpStatus: 404,
  },
  /**
   * Every GitHub-backed route answers this when the App's credentials are
   * absent. The module still boots and `GET /installations` still answers —
   * an unconfigured deployment has no installations, not a broken API.
   */
  APP_NOT_CONFIGURED: {
    code: 'GITHUB_002',
    message: 'The GitHub App is not configured on this server',
    httpStatus: 503,
  },
  /**
   * `githubInstallationId` is globally unique, so a second workspace claiming
   * an installation is a conflict rather than a constraint violation surfacing
   * as a 500.
   */
  INSTALLATION_ALREADY_CONNECTED: {
    code: 'GITHUB_003',
    message: 'That GitHub installation is already connected to another workspace',
    httpStatus: 409,
  },
  /**
   * The claim proof failed: GitHub does not list the claimed installation for
   * the account that authorized the code. Without this check a forged
   * `githubInstallationId` would mint tokens for someone else's repositories
   * (`product/09-github-app-install.md` §1).
   */
  INSTALLATION_NOT_CLAIMABLE: {
    code: 'GITHUB_004',
    message: 'GitHub does not list that installation for your account',
    httpStatus: 403,
  },
  /** The OAuth code from the installation redirect was expired or already used. */
  AUTHORIZATION_CODE_REJECTED: {
    code: 'GITHUB_005',
    message: 'GitHub rejected the authorization code',
    httpStatus: 400,
  },
  /** The tenant comes from the resolved access scope, never from the body. */
  NO_ACTIVE_ORGANIZATION: {
    code: 'GITHUB_006',
    message: 'GitHub installations are connected inside an organization',
    httpStatus: 400,
  },
  /** `X-Hub-Signature-256` did not match an HMAC of the exact bytes received. */
  WEBHOOK_SIGNATURE_INVALID: {
    code: 'GITHUB_007',
    message: 'Invalid GitHub webhook signature',
    httpStatus: 400,
  },
  /**
   * GitHub suspended the installation, or it was uninstalled. The row stays so
   * the console can say why the repositories stopped resolving; nothing is
   * listed and no token is minted while it holds.
   */
  INSTALLATION_SUSPENDED: {
    code: 'GITHUB_008',
    message: 'That GitHub installation is suspended or no longer installed',
    httpStatus: 409,
  },
  /** GitHub answered with an error, or did not answer. Never a bare 500. */
  UPSTREAM_FAILED: {
    code: 'GITHUB_009',
    message: 'GitHub could not be reached or rejected the request',
    httpStatus: 502,
  },
  /**
   * The repository is not one the installation covers — it was removed from it,
   * deleted, or never in it. There is no repository table to consult, so this
   * is what GitHub's own refusal becomes.
   */
  REPOSITORY_NOT_IN_INSTALLATION: {
    code: 'GITHUB_010',
    message: 'That repository is not covered by this GitHub installation',
    httpStatus: 404,
  },
} as const satisfies Record<string, ErrorDefinition>;
