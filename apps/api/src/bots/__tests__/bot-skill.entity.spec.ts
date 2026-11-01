import { BotSkillEntity } from '../domain/bot-skill.entity';

/**
 * A skill's invariants: a name that can be typed as a command, the
 * description and body within their bounds, someone who may run it, and its
 * source following whoever last changed its words. The table and its
 * constraints are the integration spec's.
 */
const owner = { kind: 'user', userId: 'owner-1' } as const;

function skill(overrides: Partial<Parameters<typeof BotSkillEntity.createNew>[0]> = {}) {
  return BotSkillEntity.createNew({
    organizationId: 'org-1',
    botId: 'bot-1',
    name: 'release-notes',
    description: ' Writes the release notes. ',
    body: ' 1. Read the merged pull requests. ',
    actor: owner,
    ...overrides,
  });
}

describe('BotSkillEntity', () => {
  it('starts runnable by the person and the bot, trimmed, written by whoever made it', () => {
    expect(skill()).toMatchObject({
      name: 'release-notes',
      description: 'Writes the release notes.',
      body: '1. Read the merged pull requests.',
      userInvocable: true,
      modelInvocable: true,
      source: 'user',
    });
    expect(skill({ actor: { kind: 'bot' } }).source).toBe('bot');
  });

  it('refuses a name that cannot be typed after a slash, or the generic /skill', () => {
    for (const name of ['Release', 'release notes', '-x', 'skill', 'a'.repeat(33)]) {
      expect(() => skill({ name })).toThrow();
    }
  });

  it('refuses a skill nobody may run', () => {
    expect(() => skill({ userInvocable: false, modelInvocable: false })).toThrow(
      /turn one of them on/,
    );
    const runnable = skill({ userInvocable: false });
    expect(() => runnable.edit({ modelInvocable: false }, owner)).toThrow(/turn one of them on/);
  });

  it('makes whoever rewords it its source, and not whoever only changes who runs it', () => {
    const saved = skill({ actor: { kind: 'bot' } });
    saved.edit({ userInvocable: false }, owner);
    expect(saved.source).toBe('bot');
    saved.edit({ body: 'New steps.' }, owner);
    expect(saved).toMatchObject({ body: 'New steps.', source: 'user' });
  });
});
