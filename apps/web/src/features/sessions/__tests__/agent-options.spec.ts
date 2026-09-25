import { describe, expect, it } from 'vitest';
import {
  defaultModelFor,
  launchControlsFor,
  toAgentOptions,
  toLaunchInput,
} from '../lib/session-options';

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
      'grok',
      'shell',
    ]);
  });

  it('defaults each agent to its own model, and the terminal to none', () => {
    expect(defaultModelFor('claude-code')).toBe('claude-opus-5-5');
    expect(defaultModelFor('opencode')).toBe('anthropic/claude-opus-5-5');
    expect(defaultModelFor('grok')).toBe('grok-4.6');
    expect(defaultModelFor('shell')).toBeNull();
  });

  it('shows the permission and effort chips only where the agent takes them', () => {
    expect(launchControlsFor('claude-code')).toEqual({ permission: true, effort: true });
    expect(launchControlsFor('opencode')).toEqual({ permission: true, effort: false });
    expect(launchControlsFor('grok')).toEqual({ permission: true, effort: true });
    expect(launchControlsFor('shell')).toEqual({ permission: false, effort: false });
  });

  it('sends only the controls the agent has, never a level left over from the last one', () => {
    const draft = { model: null, permission: 'full' as const, effort: 'max' as const };
    expect(toLaunchInput({ ...draft, agent: 'shell' })).toEqual({ model: null });
    expect(
      toLaunchInput({ ...draft, agent: 'opencode', model: 'anthropic/claude-opus-5-5' }),
    ).toEqual({
      model: 'anthropic/claude-opus-5-5',
      permission: 'full',
    });
    expect(toLaunchInput({ ...draft, agent: 'claude-code' })).toEqual({
      model: null,
      permission: 'full',
      effort: 'max',
    });
  });
});
