import { describe, expect, it } from 'vitest';
import type { CredentialResolverPort } from '../credential-resolver.port';
import { CredentialResolverRegistry } from '../credential-resolver.registry';

const resolverFor = (kind: string): CredentialResolverPort => ({
  kind,
  recognises: (presented) => presented.startsWith(`${kind}_`),
  resolve: () => Promise.reject(new Error('not used in this test')),
});

describe('CredentialResolverRegistry', () => {
  it('answers in registration order, so wiring decides who is asked first', () => {
    const registry = new CredentialResolverRegistry();
    const first = resolverFor('api-token');
    const contributed = [resolverFor('host'), resolverFor('oauth')];

    registry.register(first);
    registry.registerAll(contributed);

    expect(registry.all()).toEqual([first, ...contributed]);
  });

  it('refuses a second resolver claiming a kind, rather than shadowing it', () => {
    const registry = new CredentialResolverRegistry();
    registry.register(resolverFor('api-token'));

    expect(() => registry.register(resolverFor('api-token'))).toThrow(/already registered/);
  });

  it('ignores the same resolver registered twice, so a module imported twice is harmless', () => {
    const registry = new CredentialResolverRegistry();
    const resolver = resolverFor('api-token');

    registry.register(resolver);
    registry.register(resolver);

    expect(registry.all()).toEqual([resolver]);
  });
});
