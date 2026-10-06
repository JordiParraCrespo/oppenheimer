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
  it('keeps the kinds the role may read', () => {
    expect([...readableTypes(ability(['Session']), null)]).toEqual(['session.changed']);
    expect([...readableTypes(ability(['Host']), null)]).toEqual(['host.changed', 'pairing.spent']);
  });

  it("narrows a credential to its scopes, on top of its person's role", () => {
    const credential = { scopes: ['automations:read'] } as unknown as ScopeContext;
    expect([...readableTypes(ability(['Session', 'Host', 'Automation']), credential)]).toEqual([
      'automationRun.changed',
    ]);
  });

  it('answers none for a caller who may read nothing it carries', () => {
    expect(readableTypes(ability([]), null).size).toBe(0);
  });
});
