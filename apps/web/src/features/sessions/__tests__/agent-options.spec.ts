import { describe, expect, it } from 'vitest';
import {
  defaultModelFor,
  effortChoiceFor,
  engineForPlace,
  launchControlsFor,
  toEngineAgents,
  toLaunchInput,
} from '../lib/session-options';

/**
 * The engine button offers every catalog entry, and the chips beside it follow
 * what that entry can take: a blank terminal has no model, no approvals and no
 * effort, so the composer shows none of the three.
 */
describe('agent options', () => {
  it('defaults each agent to its own model, and the terminal to none', () => {
    expect(defaultModelFor('claude-code')).toBe('claude-opus-5-5');
    expect(defaultModelFor('opencode')).toBe('anthropic/claude-opus-5-5');
    expect(defaultModelFor('grok')).toBe('grok-4.6');
    expect(defaultModelFor('shell')).toBeNull();
  });

  it('keeps Claude Code or Codex in a host’s cloud, brings Claude Code for any other, and leaves the engine alone elsewhere', () => {
    const codex = { agent: 'codex' as const, model: 'gpt-6-astra' };
    const claude = { agent: 'claude-code' as const, model: 'claude-sonnet-5-5' };
    const grok = { agent: 'grok' as const, model: 'grok-4.6' };

    expect(engineForPlace({ where: 'cloud', cloudProvider: null }, grok)).toEqual({
      agent: 'claude-code',
      model: defaultModelFor('claude-code'),
    });
    // An agent whose own cloud a host starts keeps its model; a vendor's cloud and a host place keep theirs.
    expect(engineForPlace({ where: 'cloud', cloudProvider: null }, claude)).toBe(claude);
    expect(engineForPlace({ where: 'cloud', cloudProvider: null }, codex)).toBe(codex);
    expect(engineForPlace({ where: 'cloud', cloudProvider: 'cursor' }, grok)).toBe(grok);
    expect(engineForPlace({ where: 'worktree', cloudProvider: null }, grok)).toBe(grok);
  });

  it('offers Claude Code and Codex alone in a host’s cloud, and every agent elsewhere', () => {
    const cursor = { id: 'cursor', label: 'Cursor', models: [] } as Parameters<
      typeof toEngineAgents
    >[1];

    expect(toEngineAgents(true, cursor).map((option) => option.id)).toEqual([
      'claude-code',
      'codex',
    ]);
    const elsewhere = toEngineAgents(false, cursor).map((option) => option.id);
    expect(elsewhere).toContain('codex');
    expect(elsewhere.at(-1)).toBe('cursor');
  });

  it('shows the permission chip only where the agent takes approvals', () => {
    expect(launchControlsFor('claude-code')).toEqual({ permission: true });
    expect(launchControlsFor('opencode')).toEqual({ permission: true });
    expect(launchControlsFor('shell')).toEqual({ permission: false });
  });

  it('draws the effort slider over the model’s own levels, starting on its default', () => {
    expect(effortChoiceFor('claude-code', 'claude-opus-5-5', undefined)).toEqual({
      levels: ['low', 'medium', 'high', 'xhigh', 'max'],
      value: 'medium',
      chosen: false,
    });
    expect(effortChoiceFor('codex', null, undefined)?.value).toBe('low');
    // Haiku under Claude Code takes no effort, and the blank terminal none.
    expect(effortChoiceFor('claude-code', 'claude-haiku-4-5', 'high')).toBeNull();
    expect(effortChoiceFor('shell', null, 'high')).toBeNull();
  });

  it('keeps a pick the model offers; one it lacks shows the default and sends nothing', () => {
    expect(effortChoiceFor('codex', 'gpt-5.6-sol', 'ultra')).toMatchObject({
      value: 'ultra',
      chosen: true,
    });
    // Luna has no `ultra`: no level is invented for it, the CLI runs its own.
    expect(effortChoiceFor('codex', 'gpt-5.6-luna', 'ultra')).toMatchObject({
      value: 'medium',
      chosen: false,
    });
    expect(effortChoiceFor('claude-code', null, 'minimal')).toMatchObject({
      value: 'medium',
      chosen: false,
    });
  });

  it('sends only the controls the agent has, never a level left over from the last one', () => {
    const draft = {
      model: null,
      permission: 'full' as const,
      efforts: { 'claude-code': 'max' as const },
    };
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

  it('sends no effort when nobody moved the slider, so the CLI runs its own default', () => {
    expect(
      toLaunchInput({ agent: 'codex', model: 'gpt-5.6-sol', permission: 'ask', efforts: {} }),
    ).toEqual({ model: 'gpt-5.6-sol', permission: 'ask' });
  });
});
