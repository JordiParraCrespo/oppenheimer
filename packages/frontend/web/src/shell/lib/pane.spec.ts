import { describe, expect, it } from 'vitest';
import { resolveContentPane } from './pane';

/**
 * Which pane the shell draws is decided by the route, and the rule is the one
 * the auth layout already uses for its legal note: the innermost match wins.
 * It matters here because the console's layout route and its screens both sit
 * in the match chain — a screen has to be able to say "not this one" without
 * the layout above it having to know about it.
 */
const match = (pane?: 'measure' | 'full') => ({ staticData: pane ? { pane } : {} });

describe('resolveContentPane', () => {
  it('is the reading column when no route asks for anything', () => {
    expect(resolveContentPane([match(), match()])).toBe('measure');
  });

  it('takes the innermost declaration', () => {
    expect(resolveContentPane([match('measure'), match(), match('full')])).toBe('full');
  });

  it('lets a layout route set the pane for its whole subtree', () => {
    expect(resolveContentPane([match('full'), match(), match()])).toBe('full');
  });

  it('survives an empty match chain', () => {
    expect(resolveContentPane([])).toBe('measure');
  });
});
