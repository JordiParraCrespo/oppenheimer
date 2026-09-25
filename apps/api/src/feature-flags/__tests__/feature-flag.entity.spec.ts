import { describe, expect, it } from 'vitest';
import type { FlagConfigurationChangedDomainEvent } from '../domain/events/flag-configuration-changed.domain-event';
import { FeatureFlagEntity } from '../domain/feature-flag.entity';
import { FlagSegmentEntity } from '../domain/flag-segment.entity';

function eventsOf(entity: { domainEvents: readonly unknown[] }) {
  return entity.domainEvents as FlagConfigurationChangedDomainEvent[];
}

describe('FeatureFlagEntity', () => {
  it('starts configured exactly like no row at all: on, no rules, the default for everyone', () => {
    const flag = FeatureFlagEntity.createFor('api_token_creation', true);

    expect(flag.toConfig()).toMatchObject({
      key: 'api_token_creation',
      enabled: true,
      rules: [],
      fallthrough: { value: true },
    });
    expect(flag.salt).not.toBe('');
    expect(eventsOf(flag)).toHaveLength(0);
  });

  it('records who replaced the targeting, why, and the before/after', () => {
    const flag = FeatureFlagEntity.createFor('api_token_creation', true);

    flag.replaceTargeting(
      {
        enabled: true,
        rules: [{ id: 'staff', conditions: [], serve: { value: false } }],
        fallthrough: { value: true },
      },
      { actorId: 'admin-1', comment: 'staff first' },
    );

    const [event] = eventsOf(flag);
    expect(event).toMatchObject({
      subjectType: 'flag',
      subjectKey: 'api_token_creation',
      action: 'targeting_updated',
      actorId: 'admin-1',
      comment: 'staff first',
      before: { enabled: true, rules: [] },
    });
    expect(event?.after).toMatchObject({ rules: [expect.objectContaining({ id: 'staff' })] });
    expect(flag.updatedBy).toBe('admin-1');
  });

  it('audits a pulled switch, but not one pulled twice', () => {
    const flag = FeatureFlagEntity.createFor('api_token_creation', true);

    expect(flag.setEnabled(false, { actorId: 'admin-1' })).toBe(true);
    expect(flag.setEnabled(false, { actorId: 'admin-1' })).toBe(false);
    expect(eventsOf(flag).map((event) => event.action)).toEqual(['toggled']);
  });

  it('lists the segments its rules target, once each', () => {
    const flag = FeatureFlagEntity.createFor('api_token_creation', true);
    flag.replaceTargeting(
      {
        enabled: true,
        rules: [
          {
            id: 'a',
            conditions: [{ attribute: 'segment', operator: 'in', values: ['beta', 'staff'] }],
            serve: { value: true },
          },
          {
            id: 'b',
            conditions: [{ attribute: 'segment', operator: 'not_in', values: ['beta'] }],
            serve: { value: false },
          },
        ],
        fallthrough: { value: true },
      },
      { actorId: null },
    );

    expect(flag.referencedSegments().sort()).toEqual(['beta', 'staff']);
  });
});

describe('FlagSegmentEntity', () => {
  const conditions = [
    { attribute: 'email' as const, operator: 'ends_with' as const, values: ['@acme.com'] },
  ];

  it('audits its creation, updates and deletion', () => {
    const segment = FlagSegmentEntity.createNew(
      { key: 'staff', name: 'Staff', conditions },
      { actorId: 'admin-1' },
    );
    segment.update({ name: 'Acme staff' }, { actorId: 'admin-2', comment: 'rename' });
    segment.delete({ actorId: 'admin-3' });

    expect(eventsOf(segment).map((event) => [event.action, event.actorId])).toEqual([
      ['segment_created', 'admin-1'],
      ['segment_updated', 'admin-2'],
      ['segment_deleted', 'admin-3'],
    ]);
    expect(eventsOf(segment)[2]?.after).toBeNull();
    expect(segment.toSegment()).toEqual({ key: 'staff', conditions });
  });
});
