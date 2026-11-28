import { AppError, CapabilitiesService } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import { CredentialIssuanceResolver } from '../application/credential-issuance.resolver';
import type { CredentialOwnerPort } from '../application/credential-owner.port';
import { AuthErrors } from '../domain/auth.errors';

/**
 * The door an API token, a host pairing token and a routine's webhook URL are
 * issued through (`mayIssueCredential`): an unproven address is refused only
 * where the deployment can prove one.
 */
describe('CredentialIssuanceResolver', () => {
  function issuance(options: { emailDelivery: boolean; emailVerified: boolean }) {
    const owners: CredentialOwnerPort = {
      findActiveOwner: vi.fn(),
      requireActiveOwner: vi.fn(async (id: string) => ({
        id,
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: 'One',
        role: 'user',
        isActive: true,
        emailVerified: options.emailVerified,
      })),
    };
    const capabilities = new CapabilitiesService({ email_delivery: options.emailDelivery });
    return { resolver: new CredentialIssuanceResolver(owners, capabilities), owners };
  }

  // Pre-account squatting: registered first, minted, kept past the real
  // owner's "Forgot password". Regression: an unproven address was issued one.
  it('refuses an unverified account with TOKEN_010 where the deployment delivers email', async () => {
    const { resolver } = issuance({ emailDelivery: true, emailVerified: false });

    await expect(resolver.assertMayIssue('user-1')).rejects.toMatchObject({
      code: AuthErrors.EMAIL_VERIFICATION_REQUIRED.code,
    });
  });

  it('issues to a verified account where the deployment delivers email', async () => {
    const { resolver } = issuance({ emailDelivery: true, emailVerified: true });

    await expect(resolver.assertMayIssue('user-1')).resolves.toEqual({ ownerEmailVerified: true });
  });

  // No delivery: no address can ever be verified, and no reset email can
  // recover a squatted one. Regression: every account on a deployment without
  // SMTP or Resend was locked out of tokens, hosts and webhooks for good.
  it('issues to an unverified account where the deployment delivers no email', async () => {
    const { resolver } = issuance({ emailDelivery: false, emailVerified: false });

    await expect(resolver.assertMayIssue('user-1')).resolves.toEqual({ ownerEmailVerified: false });
  });

  it('still refuses an owner that is not active, with or without delivery', async () => {
    const { resolver, owners } = issuance({ emailDelivery: false, emailVerified: true });
    vi.mocked(owners.requireActiveOwner).mockRejectedValueOnce(
      new AppError(AuthErrors.INVALID_CREDENTIAL),
    );

    await expect(resolver.assertMayIssue('user-1')).rejects.toMatchObject({ code: 'TOKEN_003' });
  });
});
