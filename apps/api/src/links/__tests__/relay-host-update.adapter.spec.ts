import 'reflect-metadata';
import { hostUpdateSchema } from '@oppenheimer/shared/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';
import { RelayHostUpdateAdapter } from '../infrastructure/relay-host-update.adapter';

/**
 * Update runner's frame: a `host.update` the protocol accepts, with no
 * `version` — a version would pin the host to it, and the console asks for the
 * newest — and "offline" whenever there is no link to carry it.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';

function harness(link: { send: boolean } | null) {
  const runnerLink = {
    hostId: HOST,
    send: vi.fn().mockReturnValue(link?.send ?? false),
  } as unknown as RunnerLink;
  const links: LinkRegistryPort = {
    register: vi.fn(),
    unregister: vi.fn(),
    nextEpoch: vi.fn(),
    find: vi.fn().mockReturnValue(link ? runnerLink : undefined),
  };
  return { link: runnerLink, adapter: new RelayHostUpdateAdapter(links) };
}

describe('RelayHostUpdateAdapter', () => {
  it('sends an unpinned host.update on the channel it is given', () => {
    const { adapter, link } = harness({ send: true });

    expect(adapter.request(HOST, 'beta')).toEqual({ kind: 'requested' });
    const sent = hostUpdateSchema.strict().parse(vi.mocked(link.send).mock.calls[0]?.[0]);
    expect(sent.channel).toBe('beta');
    expect(sent).not.toHaveProperty('version');
  });

  it('answers offline when the host has no link', () => {
    const { adapter } = harness(null);
    expect(adapter.request(HOST, 'stable')).toEqual({ kind: 'host_offline' });
  });

  it('answers offline when the link can no longer be written', () => {
    const { adapter } = harness({ send: false });
    expect(adapter.request(HOST, 'stable')).toEqual({ kind: 'host_offline' });
  });
});
