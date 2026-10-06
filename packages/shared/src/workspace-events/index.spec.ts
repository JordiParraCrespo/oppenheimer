import { describe, expect, it } from 'vitest';
import { isWorkspaceEvent } from './index';

/** The guard is the contract: a variant missing a field it names is not one. */
describe('isWorkspaceEvent', () => {
  it('accepts each variant with its fields', () => {
    expect(isWorkspaceEvent({ type: 'session.changed', id: 's' })).toBe(true);
    expect(isWorkspaceEvent({ type: 'pairing.spent', id: 't', hostId: 'h' })).toBe(true);
    expect(isWorkspaceEvent({ type: 'automationRun.changed', id: 'r', automationId: 'a' })).toBe(
      true,
    );
  });

  it('refuses a variant without the field it names, or a type it does not know', () => {
    expect(isWorkspaceEvent({ type: 'pairing.spent', id: 't' })).toBe(false);
    expect(isWorkspaceEvent({ type: 'automationRun.changed', id: 'r' })).toBe(false);
    expect(isWorkspaceEvent({ type: 'invoice.paid', id: 'x' })).toBe(false);
    expect(isWorkspaceEvent({ type: 'session.changed' })).toBe(false);
    expect(isWorkspaceEvent(null)).toBe(false);
  });
});
