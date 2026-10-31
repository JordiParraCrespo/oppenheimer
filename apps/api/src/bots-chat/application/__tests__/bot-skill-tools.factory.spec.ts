import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { CreateBotSkillCommand } from '../../../bots/commands/create-bot-skill/create-bot-skill.command';
import { DeleteBotSkillCommand } from '../../../bots/commands/delete-bot-skill/delete-bot-skill.command';
import { UpdateBotSkillCommand } from '../../../bots/commands/update-bot-skill/update-bot-skill.command';
import { BotSkillEntity } from '../../../bots/domain/bot-skill.entity';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { FindBotSkillQuery } from '../../../bots/queries/find-bot-skill/find-bot-skill.query';
import { FindBotSkillsQuery } from '../../../bots/queries/find-bot-skills/find-bot-skills.query';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { BotSkillToolsFactory } from '../bot-skill-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * The bot's skill tools: each reads or writes through the bots module's own
 * query and commands as the owner, on the turn's bot. `use_skill` hands back
 * the body only of a skill the bot may use unasked; `save_skill` creates one
 * or replaces the one of that name, as the bot's. The commands are the bots
 * module's specs.
 */
const owner = emptyScope('owner-1', 'org-1');
const BOT_ID = '11111111-1111-4111-8111-111111111111';
const context: BotToolContext = {
  owner,
  organizationId: 'org-1',
  botId: BOT_ID,
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'UTC',
  permission: 'auto',
  permissions: NO_PERMISSIONS,
  budget: new BotTurnBudget(),
  credentialScopes: null,
  approvals: { request: vi.fn() },
};

function skill(
  name: string,
  invocable: { userInvocable?: boolean; modelInvocable?: boolean } = {},
) {
  return BotSkillEntity.createNew({
    organizationId: 'org-1',
    botId: BOT_ID,
    name,
    description: `Does ${name}.`,
    body: `Steps for ${name}.`,
    ...invocable,
    actor: { kind: 'user', userId: 'owner-1' },
  });
}

function setup(kept: BotSkillEntity[]) {
  const stored = [...kept];
  const queryBus = {
    execute: vi.fn(async (query: unknown) => {
      if (query instanceof FindBotSkillsQuery) return stored;
      if (query instanceof FindBotSkillQuery && 'name' in query.skill) {
        const { name } = query.skill;
        const found = stored.find((candidate) => candidate.name === name);
        if (!found) throw new AppError(BotErrors.SKILL_NOT_FOUND);
        return found;
      }
      throw new Error('unexpected query');
    }),
  };
  const commandBus = {
    execute: vi.fn(async (command: unknown) => {
      if (command instanceof CreateBotSkillCommand) stored.push(skill(command.name));
      if (command instanceof DeleteBotSkillCommand) {
        stored.splice(
          stored.findIndex((s) => s.id === command.skillId),
          1,
        );
      }
      return 'id';
    }),
  };
  const factory = new BotSkillToolsFactory(
    queryBus as unknown as QueryBus,
    commandBus as unknown as CommandBus,
  );
  const call = (name: string, input: unknown) => {
    const found = factory.definitions().find((definition) => definition.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found.bind(context).run(input, { signal: new AbortController().signal });
  };
  return { call, commandBus, queryBus };
}

describe('BotSkillToolsFactory', () => {
  it('reads a skill the bot may use in full, fenced and named', async () => {
    const { call } = setup([skill('triage')]);
    const result = await call('use_skill', { name: 'triage' });
    expect(result).toMatchObject({ isError: false });
    expect(result.content).toBe(
      'Skill "triage": Does triage. Follow it for this request.\n\n<skill name="triage">\nSteps for triage.\n</skill>',
    );
  });

  it('keeps the body of a skill only the person runs, and says how they run it', async () => {
    const { call } = setup([skill('deploy', { modelInvocable: false })]);
    const result = await call('use_skill', { name: 'deploy' });
    expect(result.content).toContain('only the person runs, by typing /deploy');
    expect(result.content).not.toContain('Steps for deploy');
  });

  it('answers a skill it does not have with BOTS_038', async () => {
    const { call } = setup([]);
    const result = await call('use_skill', { name: 'nope' });
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain('BOTS_038');
  });

  it('saves a new skill as the bot’s', async () => {
    const { call, commandBus } = setup([]);
    const result = await call('save_skill', {
      name: 'triage',
      description: 'Sorts new issues.',
      body: 'Label each.',
    });
    expect(result.content).toBe(
      'Saved skill "triage" (the person runs it as /triage; you use it when a request fits). The person can see and edit it in Settings → Skills.',
    );
    const [command] = commandBus.execute.mock.calls[0];
    expect(command).toBeInstanceOf(CreateBotSkillCommand);
    expect(command).toMatchObject({ botId: BOT_ID, author: 'bot', scope: owner });
  });

  it('replaces the skill of that name rather than adding a second', async () => {
    const existing = skill('triage');
    const { call, commandBus } = setup([existing]);
    const result = await call('save_skill', {
      name: 'triage',
      description: 'Sorts new issues by area.',
      body: 'Label each by area.',
      user_invocable: false,
    });
    expect(result.content).toMatch(/^Updated skill "triage"/);
    const [command] = commandBus.execute.mock.calls[0];
    expect(command).toBeInstanceOf(UpdateBotSkillCommand);
    expect(command).toMatchObject({
      skillId: existing.id,
      author: 'bot',
      change: { description: 'Sorts new issues by area.', userInvocable: false },
    });
  });

  it('refuses a name that could not be typed after a slash, and saves nothing', async () => {
    const { call, commandBus } = setup([]);
    const result = await call('save_skill', { name: 'Release Notes', description: 'x', body: 'y' });
    expect(result).toMatchObject({ isError: true });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('deletes a skill by name, and says how many are left', async () => {
    const { call } = setup([skill('triage'), skill('deploy')]);
    expect((await call('delete_skill', { name: 'triage' })).content).toBe(
      'Deleted skill "triage"; you have 1 left.',
    );
  });
});
