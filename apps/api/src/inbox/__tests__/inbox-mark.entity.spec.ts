import { InboxMarkChangedDomainEvent } from '../domain/events/inbox-mark-changed.domain-event';
import { InboxMarkEntity } from '../domain/inbox-mark.entity';

/**
 * A mark is always valid: placed with a key it can hold and an end with a
 * snooze only, in the future; loaded back after its snooze ended it is still
 * a mark. Placing and removing one each tell the person's other tabs.
 */
const NOW = new Date('2026-10-26T12:00:00Z');
const props = {
  organizationId: 'org-1',
  userId: 'user-1',
  itemKey: 'approval:ap-1',
  mark: 'done' as const,
  until: null,
};

describe('InboxMarkEntity', () => {
  it('is placed with an event naming the person and the occurrence', () => {
    const mark = InboxMarkEntity.place(props, NOW);
    expect(mark.domainEvents).toHaveLength(1);
    expect(mark.domainEvents[0]).toBeInstanceOf(InboxMarkChangedDomainEvent);
    expect(mark.domainEvents[0]).toMatchObject({
      organizationId: 'org-1',
      userId: 'user-1',
      itemKey: 'approval:ap-1',
    });
  });

  it('takes a snooze that ends later', () => {
    const until = new Date('2026-10-27T08:00:00Z');
    const mark = InboxMarkEntity.place({ ...props, mark: 'snoozed', until }, NOW);
    expect(mark).toMatchObject({ mark: 'snoozed', until });
  });

  it.each([
    ['a snooze with no end', { mark: 'snoozed' as const, until: null }],
    ['an end on a mark that is no snooze', { mark: 'low' as const, until: NOW }],
    ['a snooze that has already ended', { mark: 'snoozed' as const, until: NOW }],
    ['a key no occurrence has', { itemKey: 'not a key' }],
    ['a mark that does not exist', { mark: 'archived' as never }],
  ])('refuses %s', (_, change) => {
    expect(() => InboxMarkEntity.place({ ...props, ...change }, NOW)).toThrow();
  });

  it('loads back a snooze whose end has passed: the read leaves it out, not the entity', () => {
    const ended = InboxMarkEntity.create({
      id: 'm-1',
      props: { ...props, mark: 'snoozed', until: new Date('2026-01-01T00:00:00Z') },
    });
    expect(() => ended.validate()).not.toThrow();
  });

  it('announces its removal', () => {
    const mark = InboxMarkEntity.create({ id: 'm-1', props });
    mark.remove();
    expect(mark.domainEvents).toHaveLength(1);
    expect(mark.domainEvents[0]).toMatchObject({ userId: 'user-1', itemKey: 'approval:ap-1' });
  });
});
