import { describe, expect, it } from 'vitest';
import { externalEventDefinition, matchesTriggerFilter } from '../catalog';

/**
 * Whether an event fires a trigger: the one rule the API's firing and the
 * editor's preview share. What breaks this: a Gmail trigger for any mail
 * firing on a message a query trigger of the same account took from outside
 * the inbox (archived by a filter), or a query trigger missing it.
 */
describe('matchesTriggerFilter', () => {
  const mail = externalEventDefinition('gmail', 'mail_received');
  const pr = externalEventDefinition('github', 'pr_opened');

  it('fires a trigger for any mail only on mail that reached the inbox', () => {
    if (!mail) throw new Error('the catalog has no mail_received');
    expect(matchesTriggerFilter(mail, { op: 'any' }, { query: [], inbox: true })).toBe(true);
    expect(
      matchesTriggerFilter(mail, { op: 'any' }, { query: ['label:invoices'], inbox: false }),
    ).toBe(false);
    // A delivery stored before mail said where it landed.
    expect(matchesTriggerFilter(mail, { op: 'any' }, { query: [] })).toBe(false);
  });

  it('fires a query trigger on what its query matched, wherever the message landed', () => {
    if (!mail) throw new Error('the catalog has no mail_received');
    const filter = { op: 'equals', value: 'label:invoices' } as const;
    expect(matchesTriggerFilter(mail, filter, { query: ['label:invoices'], inbox: false })).toBe(
      true,
    );
    expect(matchesTriggerFilter(mail, filter, { query: [], inbox: true })).toBe(false);
  });

  it('leaves events that need nothing for any as they were', () => {
    if (!pr) throw new Error('the catalog has no pr_opened');
    expect(matchesTriggerFilter(pr, { op: 'any' }, {})).toBe(true);
    expect(matchesTriggerFilter(pr, { op: 'equals', value: 'main' }, { baseBranch: 'main' })).toBe(
      true,
    );
  });
});
