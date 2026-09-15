import { describe, expect, it } from 'vitest';
import { SCREEN_ROUTES, SCREENS } from '../screens';

/**
 * The catalog is data, so what is worth asserting about it is the shape the
 * consumers rely on — the web sidebar reads `policies` from here, and the
 * API's `screen-policies.spec.ts` walks `endpoint` to find the handler it
 * checks.
 */
describe('SCREENS', () => {
  it('has an entry for every screen route, and no others', () => {
    expect(Object.keys(SCREENS).sort()).toEqual([...SCREEN_ROUTES].sort());
  });

  it('names an absolute endpoint for each', () => {
    for (const [route, screen] of Object.entries(SCREENS)) {
      expect(screen.endpoint, route).toMatch(/^\//);
    }
  });

  /**
   * A gated screen with no rules is the bug this catalog was created for: an
   * empty list reads as "show this to everyone", which is what `/dashboard`
   * and `/emails` claimed while their endpoints refused a plain member. A
   * screen that genuinely is open to everyone does not belong here at all —
   * Settings is one, and carries no entry.
   */
  it('gates every screen on at least one rule', () => {
    for (const [route, screen] of Object.entries(SCREENS)) {
      expect(screen.policies.length, route).toBeGreaterThan(0);
    }
  });

  it('states each rule as a non-empty action and subject', () => {
    for (const [route, screen] of Object.entries(SCREENS)) {
      for (const policy of screen.policies) {
        expect(policy.action, route).not.toBe('');
        expect(policy.subject, route).not.toBe('');
      }
    }
  });
});
