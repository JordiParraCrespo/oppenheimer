import { describe, expect, it } from 'vitest';
import { type ContentPane, resolveContentPane } from './pane';

/**
 * Which pane the shell draws is decided by the route, and the rule is the one
 * the auth layout already uses for its legal note: the innermost match wins.
 * It matters here because the console's layout route and its screens both sit
 * in the match chain — a screen has to be able to say "not this one" without
 * the layout above it having to know about it.
 */
const match = (pane?: ContentPane) => ({ staticData: pane ? { pane } : {} });

describe('resolveContentPane', () => {
  it('is the narrow page when no route asks for anything', () => {
    expect(resolveContentPane([match(), match()])).toBe('narrow');
  });

  it('lets a screen take the pane from the page its layout declares', () => {
    expect(resolveContentPane([match(), match('wide'), match('full')])).toBe('full');
  });

  it('lets a layout route set the page for its whole subtree', () => {
    expect(resolveContentPane([match(), match('board'), match()])).toBe('board');
  });

  it('survives an empty match chain', () => {
    expect(resolveContentPane([])).toBe('narrow');
  });
});
