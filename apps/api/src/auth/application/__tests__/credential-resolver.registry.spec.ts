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
    const second = resolverFor('host');

    registry.register(first);
    registry.register(second);

    expect(registry.all()).toEqual([first, second]);
  });

  it('collects the resolvers one contribution registers together', () => {
    const registry = new CredentialResolverRegistry();
    const contributed = [resolverFor('api-token'), resolverFor('host')];

    registry.registerAll(contributed);

    expect(registry.all().map((resolver) => resolver.kind)).toEqual(['api-token', 'host']);
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

  it('starts empty: a kernel with no contribution accepts no scoped credential', () => {
    expect(new CredentialResolverRegistry().all()).toEqual([]);
  });
});
