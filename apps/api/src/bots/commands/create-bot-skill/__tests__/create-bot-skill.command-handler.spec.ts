import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { BOT_SKILLS_MAX } from '@oppenheimer/shared';
import { Some } from 'oxide.ts';
import { BotLookupResolver } from '../../../application/bot-lookup.resolver';
import type { BotRepositoryPort } from '../../../database/bot.repository.port';
import type { BotSkillRepositoryPort } from '../../../database/bot-skill.repository.port';
import { BotEntity } from '../../../domain/bot.entity';
import { CreateBotSkillCommand } from '../create-bot-skill.command';
import { CreateBotSkillCommandHandler } from '../create-bot-skill.command-handler';

/**
 * A new skill under the per-bot cap, its name the bot's only one; the
 * counted-under-lock insert and the unique name are the integration spec's.
 */
const userId = randomUUID();
const scope: AccessScope = {
  userId,
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup(outcome: Awaited<ReturnType<BotSkillRepositoryPort['insert']>> = 'inserted') {
  const bot = BotEntity.createNew({
    organizationId: scope.organizationId as string,
    createdByUserId: userId,
    name: 'Ana',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: 'anthropic',
  });
  const bots = {
    findOneById: vi.fn<BotRepositoryPort['findOneById']>(async () => Some(bot)),
  } satisfies Pick<BotRepositoryPort, 'findOneById'>;
  const skills = {
    insert: vi.fn<BotSkillRepositoryPort['insert']>(async () => outcome),
  } satisfies Pick<BotSkillRepositoryPort, 'insert'>;
  const handler = new CreateBotSkillCommandHandler(
    new BotLookupResolver(bots as unknown as BotRepositoryPort),
    skills as unknown as BotSkillRepositoryPort,
  );
  const add = (extra: Partial<ConstructorParameters<typeof CreateBotSkillCommand>[0]> = {}) =>
    handler.execute(
      new CreateBotSkillCommand({
        scope,
        botId: bot.id,
        name: 'triage',
        description: 'Sorts new issues.',
        body: 'Label each issue.',
        ...extra,
      }),
    );
  return { bot, skills, add };
}

describe('CreateBotSkillCommandHandler', () => {
  it('adds the skill as the caller’s, under the per-bot cap', async () => {
    const { bot, skills, add } = setup();
    await add();
    const [skill, max] = skills.insert.mock.calls[0];
    expect(skill).toMatchObject({ botId: bot.id, name: 'triage', source: 'user' });
    expect(max).toBe(BOT_SKILLS_MAX);
  });

  it('records a skill the bot saved as the bot’s', async () => {
    const { skills, add } = setup();
    await add({ author: 'bot', userInvocable: false });
    expect(skills.insert.mock.calls[0][0]).toMatchObject({ source: 'bot', userInvocable: false });
  });

  it('refuses past the cap with BOTS_040', async () => {
    await expect(setup('full').add()).rejects.toMatchObject({ code: 'BOTS_040' });
  });

  it('refuses a name the bot already has with BOTS_039', async () => {
    await expect(setup('taken').add()).rejects.toMatchObject({ code: 'BOTS_039' });
  });

  it('answers BOTS_001 when the bot went while it was added', async () => {
    await expect(setup('missing').add()).rejects.toMatchObject({ code: 'BOTS_001' });
  });

  it('refuses a skill nobody may run before it reaches the table', async () => {
    const { skills, add } = setup();
    await expect(add({ userInvocable: false, modelInvocable: false })).rejects.toThrow();
    expect(skills.insert).not.toHaveBeenCalled();
  });
});
