import { inboxMarkProblem, isInboxItemKey, isInboxMarkInForce } from '../domain/inbox-mark.policy';

/**
 * The mark rules (`29-inbox.md` §3) as one decision table: the key an
 * occurrence may have, an end with a snooze and only with one, and that end
 * in the future. The entity and the handlers ask this; their specs prove they
 * do, this one proves what it says.
 */
const NOW = new Date('2026-10-26T12:00:00Z');
const LATER = new Date('2026-10-26T13:00:00Z');

describe('isInboxItemKey', () => {
  it.each([
    'approval:3f1c2d9e-0000-4000-8000-000000000001',
    'session:3f1c2d9e-0000-4000-8000-000000000001:2026-10-26T11:59:30.000Z',
    'pull:123456#121@a1b2c3d4e5f6',
    'run:r-1',
  ])('takes %s', (key) => {
    expect(isInboxItemKey(key)).toBe(true);
  });

  it.each([
    ['no kind', ':abc'],
    ['no id', 'approval:'],
    ['an upper-case kind', 'Approval:1'],
    ['a slash', 'pull:org/repo#1'],
    ['a space', 'run:a b'],
    ['too long', `run:${'a'.repeat(191)}`],
  ])('refuses %s', (_, key) => {
    expect(isInboxItemKey(key)).toBe(false);
  });
});

describe('inboxMarkProblem', () => {
  const key = 'approval:ap-1';

  it('passes a plain mark, and a snooze that ends later', () => {
    expect(inboxMarkProblem({ itemKey: key, mark: 'done', until: null }, NOW)).toBeNull();
    expect(inboxMarkProblem({ itemKey: key, mark: 'snoozed', until: LATER }, NOW)).toBeNull();
  });

  it('wants an end with a snooze, and only with one', () => {
    expect(inboxMarkProblem({ itemKey: key, mark: 'snoozed', until: null }, NOW)).toBe(
      'until_missing',
    );
    expect(inboxMarkProblem({ itemKey: key, mark: 'low', until: LATER }, NOW)).toBe(
      'until_unexpected',
    );
  });

  it('refuses a snooze ending now or before', () => {
    expect(inboxMarkProblem({ itemKey: key, mark: 'snoozed', until: NOW }, NOW)).toBe('until_past');
  });

  it('names a bad key before anything else', () => {
    expect(inboxMarkProblem({ itemKey: 'nope', mark: 'snoozed', until: null }, NOW)).toBe(
      'item_key',
    );
  });
});

describe('isInboxMarkInForce', () => {
  it('holds every mark but a snooze whose end has passed', () => {
    expect(isInboxMarkInForce('done', null, NOW)).toBe(true);
    expect(isInboxMarkInForce('snoozed', LATER, NOW)).toBe(true);
    expect(isInboxMarkInForce('snoozed', NOW, NOW)).toBe(false);
  });
});
