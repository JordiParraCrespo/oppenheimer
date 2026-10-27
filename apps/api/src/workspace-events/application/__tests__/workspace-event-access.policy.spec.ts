import type { AppAbility } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import type { ScopeContext } from '../../../auth/domain/scope-context.types';
import { readableTypes } from '../workspace-event-access.policy';

const ability = (readable: string[]) =>
  ({ can: (_action: string, subject: string) => readable.includes(subject) }) as AppAbility;

/**
 * The feed opens for whoever may read any one kind of change, and carries
 * only those. Requiring every kind refused a role that lacked one, and that
 * role's console then never had a stream at all.
 */
describe('readableTypes', () => {
  it('keeps the kinds the role may read, and the caller’s own Inbox', () => {
    expect([...readableTypes(ability(['Session']), null)]).toEqual([
      'session.changed',
      'inboxMark.changed',
    ]);
    expect([...readableTypes(ability(['Host']), null)]).toEqual([
      'host.changed',
      'pairing.spent',
      'inboxMark.changed',
    ]);
    expect([...readableTypes(ability(['Bot']), null)]).toEqual([
      'botApproval.changed',
      'inboxMark.changed',
    ]);
  });

  it("narrows a credential to its scopes, on top of its person's role", () => {
    const credential = { scopes: ['automations:read'] } as unknown as ScopeContext;
    expect([...readableTypes(ability(['Session', 'Host', 'Automation']), credential)]).toEqual([
      'automationRun.changed',
    ]);
  });

  /** No role grants a person their own Inbox, so none can take it away; a credential can. */
  it('carries the Inbox to any person, and to a credential only with inbox:read', () => {
    expect([...readableTypes(ability([]), null)]).toEqual(['inboxMark.changed']);
    const credential = { scopes: ['inbox:write'] } as unknown as ScopeContext;
    expect([...readableTypes(ability([]), credential)]).toEqual(['inboxMark.changed']);
  });

  it('answers none for a credential that may read nothing it carries', () => {
    const credential = { scopes: ['profile:read'] } as unknown as ScopeContext;
    expect(readableTypes(ability(['Session']), credential).size).toBe(0);
  });
});
