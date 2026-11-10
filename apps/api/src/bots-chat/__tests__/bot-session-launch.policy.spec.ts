import { CODING_AGENT_IDS, CODING_AGENTS } from '@oppenheimer/shared/agents';
import {
  launchPhrase,
  modelChoicesByAgent,
  modelNamed,
  newestOfFamily,
  planBotSessionLaunch,
} from '../domain/bot-session-launch.policy';

/**
 * A bot launches a session the way the console's composer does: any model
 * the agent's engine button offers, at any effort that model takes, at any
 * permission level. What breaks this: a bot that can only start sessions on
 * the host's default model, which is what it told the person ("I can't
 * choose the model when I start a session").
 */
describe('planBotSessionLaunch', () => {
  it('launches every model the console offers each agent, by its id and by its name', () => {
    for (const agent of ['claude-code', 'codex', 'grok'] as const) {
      for (const model of CODING_AGENTS[agent].models) {
        expect(planBotSessionLaunch(agent, { model: model.id })).toEqual({
          launch: { model: model.id, permission: 'auto' },
        });
        expect(planBotSessionLaunch(agent, { model: model.label })).toEqual({
          launch: { model: model.id, permission: 'auto' },
        });
      }
    }
  });

  it('reads a model the way a person says it', () => {
    expect(modelNamed('claude-code', 'opus 5.5')?.id).toBe('claude-opus-5-5');
    expect(modelNamed('claude-code', 'Opus-5.5')?.id).toBe('claude-opus-5-5');
    expect(modelNamed('claude-code', 'claude opus 5.5')?.id).toBe('claude-opus-5-5');
    // A bare family is that line's newest, as `claude --model opus` reads it.
    expect(modelNamed('claude-code', 'sonnet')?.id).toBe('claude-sonnet-5-5');
    expect(modelNamed('claude-code', 'Fable')?.id).toBe('claude-fable-5-2');
    expect(modelNamed('claude-code', 'opus 9')).toBeNull();
  });

  // The rule, over the whole catalog: a family word names the first current
  // model whose name holds it, newest first, and never a legacy one.
  it('reads every family in the catalog as its newest current model', () => {
    for (const agent of CODING_AGENT_IDS) {
      const current = CODING_AGENTS[agent].models.filter((model) => !model.legacy);
      for (const model of current) {
        for (const family of model.label.toLowerCase().split(/[^a-z0-9.]+/)) {
          if (!/^[a-z]+$/.test(family)) continue;
          const newest = current.find((row) =>
            row.label
              .toLowerCase()
              .split(/[^a-z0-9.]+/)
              .includes(family),
          );
          expect(newestOfFamily(agent, family)).toBe(newest);
        }
      }
    }
    expect(newestOfFamily('claude-code', 'opus 9')).toBeNull();
  });

  it('carries the effort and the permission the person chose', () => {
    expect(
      planBotSessionLaunch('claude-code', {
        model: 'Opus 5.5',
        effort: 'high',
        permission: 'full',
      }),
    ).toEqual({ launch: { model: 'claude-opus-5-5', effort: 'high', permission: 'full' } });
    // No model: the effort is checked against the default model, which is what runs.
    expect(planBotSessionLaunch('claude-code', { effort: 'max' })).toEqual({
      launch: { effort: 'max', permission: 'auto' },
    });
  });

  it('starts at auto when the person named no permission, so nobody waits on an approval', () => {
    expect(planBotSessionLaunch('claude-code', {})).toEqual({ launch: { permission: 'auto' } });
  });

  it('refuses what the agent does not take, with what it does take', () => {
    const unknown = planBotSessionLaunch('claude-code', { model: 'gpt-6.1-sol' });
    expect(unknown).toEqual({ refusal: expect.stringContaining('Opus 5.5 (claude-opus-5-5, default)') });
    expect(planBotSessionLaunch('claude-code', { model: 'Haiku 4.5', effort: 'high' })).toEqual({
      refusal: expect.stringContaining('takes no effort'),
    });
    expect(planBotSessionLaunch('claude-code', { model: 'Opus 5.5', effort: 'ultra' })).toEqual({
      refusal: expect.stringContaining('Its levels, faster to smarter: '),
    });
    expect(planBotSessionLaunch('shell', { model: 'Opus 5.5' })).toEqual({
      refusal: expect.stringContaining('takes no model'),
    });
    expect(planBotSessionLaunch('shell', { permission: 'full' })).toEqual({
      refusal: expect.stringContaining('no approvals'),
    });
  });
});

describe('modelChoicesByAgent', () => {
  // What breaks this: an agent with a long catalog (OpenCode) left out of the
  // tool's description, so the bot never learns it can pick one of its models.
  it('names every agent that has models, the long ones cut rather than dropped', () => {
    const choices = modelChoicesByAgent();
    for (const agent of CODING_AGENT_IDS) {
      if (CODING_AGENTS[agent].models.length === 0) continue;
      expect(choices).toContain(`${CODING_AGENTS[agent].label}: `);
    }
    expect(choices).toContain('Opus 5.5 (claude-opus-5-5, default)');
  });
});

describe('launchPhrase', () => {
  // What breaks this: a card that hides an escalation (full access) or the
  // model the person is approving.
  it('names on the card each choice that differs from the default', () => {
    expect(
      launchPhrase('claude-code', { model: 'opus 5.5', effort: 'high', permission: 'full' }),
    ).toBe('Opus 5.5, high effort, full access');
    expect(launchPhrase('claude-code', {})).toBe('');
  });
});
