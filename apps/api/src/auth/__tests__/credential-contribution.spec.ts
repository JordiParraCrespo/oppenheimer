import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import type { CredentialResolverPort } from '../application/credential-resolver.port';
import { CredentialResolverRegistry } from '../application/credential-resolver.registry';
import { AuthModule } from '../auth.module';
import type { ScopeContext } from '../domain/scope-context.types';

/**
 * A token the contributing module keeps to itself. If the contribution were
 * built anywhere but in that module's injector, this would not resolve — which
 * is the property the whole arrangement exists for: contributing a credential
 * kind must not force a module to publish its ports application-wide.
 */
const FEATURE_ONLY = Symbol('FEATURE_ONLY');

@Injectable()
class FeatureCredentialResolver implements CredentialResolverPort {
  readonly kind = 'feature-credential';

  constructor(@Inject(FEATURE_ONLY) private readonly store: { known: string }) {}

  recognises(presented: string): boolean {
    return presented === this.store.known;
  }

  resolve(): Promise<ScopeContext> {
    return Promise.reject(new Error('not exercised by this test'));
  }
}

/**
 * Stands in for the root `AuthModule`, which cannot boot here: it configures
 * Better Auth and the ORM. What matters is that the registry is a global
 * provider of the kernel's, which is exactly how the real module publishes it.
 */
@Global()
@Module({ providers: [CredentialResolverRegistry], exports: [CredentialResolverRegistry] })
class KernelStubModule {}

@Module({
  providers: [
    { provide: FEATURE_ONLY, useValue: { known: 'feature_secret' } },
    ...AuthModule.contributeCredentials([FeatureCredentialResolver]),
  ],
})
class FeatureModule {}

describe('AuthModule.contributeCredentials', () => {
  it('registers the contribution at boot, with nothing injecting it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [KernelStubModule, FeatureModule],
    }).compile();
    await moduleRef.init();

    const registry = moduleRef.get(CredentialResolverRegistry);

    expect(registry.all().map((resolver) => resolver.kind)).toEqual(['feature-credential']);
  });

  it('builds the resolver in the contributing module’s injector', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [KernelStubModule, FeatureModule],
    }).compile();
    await moduleRef.init();

    const [resolver] = moduleRef.get(CredentialResolverRegistry).all();

    // Resolved from a provider only `FeatureModule` declares.
    expect(resolver.recognises('feature_secret')).toBe(true);
    expect(resolver.recognises('something_else')).toBe(false);
  });
});
