import { describe, expect, it, vi } from 'vitest';
import type { RunnerLink } from '../application/link-registry.port';
import { InProcessLinkRegistry } from '../infrastructure/link-registry.adapter';

function link(hostId: string, epoch: number): RunnerLink {
  return {
    hostId,
    runId: `run-${epoch}`,
    epoch,
    send: vi.fn().mockReturnValue(true),
    sendBinary: vi.fn().mockReturnValue(true),
    openAttachment: vi.fn(),
    closeAttachment: vi.fn(),
    attachment: vi.fn(),
    attachmentCount: 0,
  };
}

describe('InProcessLinkRegistry', () => {
  it('answers the link a host holds, and nothing for a host with none', () => {
    const registry = new InProcessLinkRegistry();
    const first = link('host-1', 1);
    expect(registry.register(first)).toBeUndefined();
    expect(registry.find('host-1')).toBe(first);
    expect(registry.find('host-2')).toBeUndefined();
  });

  it('replaces an older link for the same host and reports it', () => {
    const registry = new InProcessLinkRegistry();
    const older = link('host-1', 1);
    const newer = link('host-1', 2);
    registry.register(older);
    expect(registry.register(newer)).toBe(older);
    expect(registry.find('host-1')).toBe(newer);
  });

  it('ignores an unregister from a link that was already replaced', () => {
    const registry = new InProcessLinkRegistry();
    const older = link('host-1', 1);
    const newer = link('host-1', 2);
    registry.register(older);
    registry.register(newer);
    // The old socket's close event arrives after the new link is up.
    registry.unregister(older);
    expect(registry.find('host-1')).toBe(newer);
    registry.unregister(newer);
    expect(registry.find('host-1')).toBeUndefined();
  });

  it('counts epochs per host', () => {
    const registry = new InProcessLinkRegistry();
    expect(registry.nextEpoch('a')).toBe(1);
    expect(registry.nextEpoch('a')).toBe(2);
    expect(registry.nextEpoch('b')).toBe(1);
  });
});
