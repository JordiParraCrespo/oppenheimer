import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { CredentialResolverRegistry } from '../../auth/application/credential-resolver.registry';
import { AuthModule } from '../../auth/auth.module';
import { isHostCredential } from '../../auth/domain/scope-context.types';
import type { HostAssertionPort } from '../application/host-assertion.port';
import { HostCredentialResolver } from '../application/host-credential.resolver';
import { HOST_ASSERTION } from '../hosts.di-tokens';

/** A compact JWS whose header says `EdDSA`, as a runner's boot assertion is. */
const ASSERTION = 'header.claims.signature';

const EXPIRES_AT = new Date('2026-09-20T12:05:00.000Z');

/**
 * Stands in for the real verifier. What matters here is that the resolver
 * reaches it through the port at all: it is bound to `HOST_ASSERTION`, which
 * `HostsModule` publishes to its own injector and no longer has to publish
 * application-wide.
 */
const assertions: HostAssertionPort = {
  recognises: (bearer) => bearer.split('.').length === 3,
  verify: async (assertion) => {
    if (assertion !== ASSERTION) throw new Error('the double refuses anything else');
    return { hostId: 'host-1', expiresAt: EXPIRES_AT };
  },
};

/**
 * Stands in for the root `AuthModule`, which cannot boot here: it configures
 * Better Auth and the ORM. What matters is that the registry is a global
 * provider of the kernel's, which is exactly how the real module publishes it.
 */
@Global()
@Module({ providers: [CredentialResolverRegistry], exports: [CredentialResolverRegistry] })
class KernelStubModule {}

/**
 * `HostsModule`'s contribution, with the one port the resolver needs and
 * nothing else — the real module cannot boot in a unit test (TypeORM, CQRS, the
 * authz kernel), but this is the same provider list shape, and deliberately not
 * `@Global`.
 */
@Module({
  providers: [
    { provide: HOST_ASSERTION, useValue: assertions },
    ...AuthModule.contributeCredentials([HostCredentialResolver]),
  ],
})
class HostsContributionModule {}

async function bootedRegistry(): Promise<CredentialResolverRegistry> {
  const moduleRef = await Test.createTestingModule({
    imports: [KernelStubModule, HostsContributionModule],
  }).compile();
  await moduleRef.init();
  return moduleRef.get(CredentialResolverRegistry);
}

describe('the hosts module’s credential contribution', () => {
  it('registers the host kind at boot, with nothing injecting it', async () => {
    const registry = await bootedRegistry();

    expect(registry.all().map((resolver) => resolver.kind)).toEqual(['host']);
  });

  it('builds the resolver in the hosts injector, over this module’s own port', async () => {
    const [resolver] = (await bootedRegistry()).all();

    // Answered by a provider only `HostsContributionModule` declares, which is
    // the property the contribution shape exists for: recognising a machine
    // costs the module no application-wide publication.
    expect(resolver.recognises(ASSERTION)).toBe(true);
    expect(resolver.recognises('oppenheimer_pat_not_a_host')).toBe(false);
  });

  it('resolves a verified assertion to a credential with no owner and no scopes', async () => {
    const [resolver] = (await bootedRegistry()).all();

    const credential = await resolver.resolve(ASSERTION, { headers: {} });

    expect(isHostCredential(credential)).toBe(true);
    expect(credential).toMatchObject({
      kind: 'host',
      credentialId: 'host:host-1',
      hostId: 'host-1',
      scopes: [],
      expiresAt: EXPIRES_AT,
    });
    expect(credential).not.toHaveProperty('owner');
    expect(credential).not.toHaveProperty('userId');
    expect(credential.resourceScope.organizationIds).toBeNull();
  });

  it('lets the port’s refusal through, so a claimed string never falls back', async () => {
    const [resolver] = (await bootedRegistry()).all();

    await expect(resolver.resolve('other.claims.signature', { headers: {} })).rejects.toThrow();
  });
});
