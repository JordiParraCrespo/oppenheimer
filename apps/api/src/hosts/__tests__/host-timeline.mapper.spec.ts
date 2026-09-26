import { describe, expect, it } from 'vitest';
import { HostEntity } from '../domain/host.entity';
import { HostMapper } from '../host.mapper';

function host() {
  return HostEntity.create({
    id: 'host-1',
    props: {
      ownerUserId: 'jordi',
      name: 'optimus',
      hostname: null,
      os: null,
      arch: null,
      runnerVersion: null,
      capabilities: null,
      publicKey: 'a'.repeat(44),
      publicKeyFingerprint: 'f'.repeat(64),
      lastSeenAt: null,
      unpairedAt: null,
    },
  });
}

describe('HostMapper timeline', () => {
  const mapper = new HostMapper();

  it('projects a rename and an unpair onto the timeline, from the aggregate’s own events', () => {
    const renamed = host();
    renamed.rename('build-02');
    renamed.unpair();
    expect(mapper.toTimelineEntries(renamed.domainEvents)).toEqual([
      { kind: 'renamed', payload: { from: 'optimus', to: 'build-02' } },
      { kind: 'unpaired', payload: {} },
    ]);
  });

  it('writes nothing for a rename to the same name', () => {
    const same = host();
    same.rename('optimus');
    expect(mapper.toTimelineEntries(same.domainEvents)).toEqual([]);
  });

  it('round-trips its own cursor and treats anything else as the first page', () => {
    const cursor = { occurredAt: new Date('2026-09-26T10:00:00.000Z'), id: '42' };
    expect(mapper.decodeTimelineCursor(mapper.encodeTimelineCursor(cursor) ?? undefined)).toEqual(
      cursor,
    );
    expect(mapper.decodeTimelineCursor('not-a-cursor')).toBeNull();
    expect(mapper.decodeTimelineCursor(undefined)).toBeNull();
    expect(mapper.encodeTimelineCursor(null)).toBeNull();
  });
});
