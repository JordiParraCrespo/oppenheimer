import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';
import {
  organizationClaimRefusal,
  personalClaimRefusal,
} from '../domain/installation-claim.policy';
import { GITHUB_APP } from '../github.di-tokens';
import type { GithubAppPort, GithubInstallationClaim } from '../infrastructure/github-app.port';
import { GithubUserGrantResolver } from './github-user-grant.resolver';

/**
 * The GitHub half of a claim on an installation, with no fallback for any
 * step: the OAuth `code` from the install redirect names the GitHub account
 * that authorized, GitHub must list the installation for it, and that account
 * must control the account the installation is on: be that personal account,
 * or an active owner of that organization (`domain/installation-claim.policy.ts`).
 * Every path that lands a claim (a new row, a refresh, a reconnect) comes
 * through here first.
 */
@Injectable()
export class InstallationClaimResolver {
  constructor(
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
    private readonly userGrants: GithubUserGrantResolver,
  ) {}

  /** The claimed installation as GitHub reports it, once the claim is proven. */
  async prove(
    userId: string,
    code: string,
    githubInstallationId: number,
  ): Promise<GithubInstallationClaim> {
    if (!this.github.isConfigured()) {
      throw new AppError(GithubErrors.APP_NOT_CONFIGURED);
    }

    const authorization = await this.github.listUserInstallations(code);
    const canSee = authorization.installations.some(
      (candidate) => candidate.githubInstallationId === githubInstallationId,
    );
    if (!canSee) {
      throw this.refusal(
        githubInstallationId,
        `GitHub does not list installation ${githubInstallationId} for the authorizing account`,
      );
    }

    // Seeing it is not controlling it: GitHub lists an installation for anyone
    // with explicit access to one repository it covers.
    const claim = await this.github.readInstallation(githubInstallationId);
    const refusal =
      claim.accountType === 'User'
        ? personalClaimRefusal(claim, authorization.user.githubUserId)
        : organizationClaimRefusal(
            claim,
            await this.github.readOrganizationMembership(authorization, claim.accountLogin),
          );
    if (refusal) throw this.refusal(githubInstallationId, refusal);

    // The user token the code bought: kept, so the Pull requests area can act in this person's name.
    await this.userGrants.keep(userId, authorization.user, authorization.tokens);
    return claim;
  }

  private refusal(githubInstallationId: number, detail: string): AppError {
    return new AppError(GithubErrors.INSTALLATION_NOT_CLAIMABLE, {
      detail,
      extensions: { githubInstallationId },
    });
  }
}
