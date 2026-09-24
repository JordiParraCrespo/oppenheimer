import { describe, expect, it } from 'vitest';
import { defaultModelFor, hasEffort, hasPermission, toAgentOptions } from '../lib/session-options';

/**
 * The engine button offers every catalog entry, and the chips beside it follow
 * what that entry can take: a blank terminal has no model, no approvals and no
 * effort, so the composer shows none of the three.
 */
describe('agent options', () => {
  it('offers the agents and the blank terminal, in catalog order', () => {
    expect(toAgentOptions().map((agent) => agent.id)).toEqual([
      'claude-code',
      'codex',
      'opencode',
      'shell',
    ]);
  });

  it('defaults each agent to its own model, and the terminal to none', () => {
    expect(defaultModelFor('claude-code')).toBe('claude-opus-5-5');
    expect(defaultModelFor('opencode')).toBe('anthropic/claude-opus-5-5');
    expect(defaultModelFor('shell')).toBeNull();
  });

  it('shows the permission and effort chips only where the agent takes them', () => {
    expect(hasPermission('claude-code')).toBe(true);
    expect(hasPermission('opencode')).toBe(true);
    expect(hasPermission('shell')).toBe(false);
    expect(hasEffort('opencode')).toBe(false);
    expect(hasEffort('shell')).toBe(false);
  });
});
