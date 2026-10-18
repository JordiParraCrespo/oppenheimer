import { RUNNER_LINK_CLOSE_CODES, RUNNER_LINK_CLOSE_REASONS } from '@oppenheimer/shared/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../../links/application/link-registry.port';
import { HostUnpairedDomainEventHandler } from '../application/event-handlers/host-unpaired.domain-event-handler';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';

function registry(link: RunnerLink | undefined): LinkRegistryPort {
  return { find: vi.fn(() => link) } as unknown as LinkRegistryPort;
}

describe('HostUnpairedDomainEventHandler', () => {
  it('closes the unpaired host’s link with the terminal code', () => {
    const link = { hostId: HOST, close: vi.fn() } as unknown as RunnerLink;
    new HostUnpairedDomainEventHandler(registry(link)).handle({ aggregateId: HOST });

    expect(link.close).toHaveBeenCalledWith(RUNNER_LINK_CLOSE_CODES.UNPAIRED, 'host unpaired');
  });

  it('says in the reason when the owner asked for the machine to be cleaned up', () => {
    const link = { hostId: HOST, close: vi.fn() } as unknown as RunnerLink;
    new HostUnpairedDomainEventHandler(registry(link)).handle({ aggregateId: HOST, wipe: true });

    expect(link.close).toHaveBeenCalledWith(
      RUNNER_LINK_CLOSE_CODES.UNPAIRED,
      RUNNER_LINK_CLOSE_REASONS.WIPE,
    );
  });

  it('does nothing for a host with no link on this instance', () => {
    // A throw here would surface in whatever emitted the unpair.
    expect(() =>
      new HostUnpairedDomainEventHandler(registry(undefined)).handle({ aggregateId: HOST }),
    ).not.toThrow();
  });
});
