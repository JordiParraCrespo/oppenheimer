import { Inject, Injectable } from '@nestjs/common';
import { AppError, CapabilitiesService } from '@oppenheimer/backend-core';
import { CREDENTIAL_OWNER } from '../auth.di-tokens';
import { AuthErrors } from '../domain/auth.errors';
import { mayIssueCredential } from '../domain/credential-issuance.policy';
import type { CredentialIssuancePort } from './credential-issuance.port';
import type { CredentialOwnerPort } from './credential-owner.port';

/**
 * The `CREDENTIAL_ISSUANCE` adapter: the account as it is now, and whether
 * this deployment delivers email, handed to `mayIssueCredential`.
 */
@Injectable()
export class CredentialIssuanceResolver implements CredentialIssuancePort {
  constructor(
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
    private readonly capabilities: CapabilitiesService,
  ) {}

  async assertMayIssue(userId: string): Promise<void> {
    const owner = await this.owners.requireActiveOwner(userId);
    if (!mayIssueCredential(owner, { emailDelivery: this.emailDelivery })) {
      throw new AppError(AuthErrors.EMAIL_VERIFICATION_REQUIRED);
    }
  }

  /** Without it no address can be verified; `mayIssueCredential` says why that lifts the rule. */
  private get emailDelivery(): boolean {
    return this.capabilities.has('email_delivery');
  }
}
