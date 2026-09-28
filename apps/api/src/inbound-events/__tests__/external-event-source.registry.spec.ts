import { describe, expect, it } from 'vitest';
import type { ExternalEventSourcePort } from '../application/external-event-source.port';
import { ExternalEventSourceRegistry } from '../application/external-event-source.registry';

function source(id: string): ExternalEventSourcePort {
  return {
    id,
    accepts: () => true,
    resolveTenants: async () => [],
    normalize: () => [],
  } as unknown as ExternalEventSourcePort;
}

describe('ExternalEventSourceRegistry', () => {
  it('finds a contributed source by its id', () => {
    const registry = new ExternalEventSourceRegistry();
    const github = source('github');
    registry.registerAll([github]);
    expect(registry.find('github')).toBe(github);
    expect(registry.find('slack')).toBeUndefined();
  });

  it('refuses a second adapter for the same source at boot', () => {
    const registry = new ExternalEventSourceRegistry();
    registry.registerAll([source('github')]);
    expect(() => registry.registerAll([source('github')])).toThrow(/Two adapters/);
  });
});
