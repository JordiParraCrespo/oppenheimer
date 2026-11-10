import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import {
  BOT_SKILL_BODY_MAX,
  BOT_SKILL_DESCRIPTION_MAX,
  BOT_SKILL_NAME_MAX,
} from '@oppenheimer/shared';
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
 * or replaces the one of that name, as the bot's; `patch_skill` replaces one
 * passage of a skill the bot wrote, or of the person's only when they asked,
 * and neither saves over nor fixes one of Oppenheimer's own.
 * The commands are the bots module's specs; the patch rule's whole table is
 * `bot-skill-learning.policy.spec.ts`.
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
  writtenBy: 'user' | 'bot' = 'user',
) {
  return BotSkillEntity.createNew({
    organizationId: 'org-1',
    botId: BOT_ID,
    name,
    description: `Does ${name}.`,
    body: `Steps for ${name}.`,
    ...invocable,
    actor: writtenBy === 'bot' ? { kind: 'bot' } : { kind: 'user', userId: 'owner-1' },
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
    const { call } = setup([skill('triage', {}, 'bot')]);
    const result = await call('use_skill', { name: 'triage' });
    expect(result).toMatchObject({ isError: false });
    expect(result.content).toBe(
      'Skill "triage": Does triage. Follow it for this request.\n\n<skill name="triage">\nSteps for triage.\n</skill>\n\nYou wrote this skill last. If a step turns out wrong or out of date while you follow it, fix it with patch_skill once the task is done, and say so in your answer.',
    );
  });

  // The regression (2026-11-10): told nothing of who wrote it, the bot left
  // its own stale step alone and tried to patch the person's.
  it('says a skill the person wrote last is theirs, to propose a change to rather than fix', async () => {
    const { call } = setup([skill('triage', {}, 'user')]);
    const result = await call('use_skill', { name: 'triage' });
    expect(result.content).toMatch(
      /<\/skill>\n\nThe person wrote this skill last: it is their words\. .*change it only if they ask\.$/,
    );
    expect(result.content).not.toContain('patch_skill');
  });

  it('hands back a skill of the longest body allowed whole, never cut to fit a tool answer', async () => {
    const long = BotSkillEntity.createNew({
      organizationId: 'org-1',
      botId: BOT_ID,
      name: 'a'.repeat(BOT_SKILL_NAME_MAX),
      description: 'd'.repeat(BOT_SKILL_DESCRIPTION_MAX),
      body: `start ${'x'.repeat(BOT_SKILL_BODY_MAX - 10)} end`,
      actor: { kind: 'user', userId: 'owner-1' },
    });
    const { call } = setup([long]);
    const result = await call('use_skill', { name: long.name });
    expect(result.content).toContain(long.body);
    expect(result.content).not.toContain('cut from the middle');
  });

  it('keeps the body of a skill only the person runs, and says how they run it', async () => {
    const { call } = setup([skill('deploy', { modelInvocable: false })]);
    const result = await call('use_skill', { name: 'deploy' });
    expect(result.content).toContain('only the person runs, by typing /deploy');
    expect(result.content).not.toContain('Steps for deploy');
  });

  it('reads the built-in oppenheimer skill every bot has, with no row of its own', async () => {
    const { call } = setup([]);
    const result = await call('use_skill', { name: 'oppenheimer' });
    expect(result).toMatchObject({ isError: false });
    expect(result.content).toContain('<skill name="oppenheimer">');
    expect(result.content).toContain('read_oppenheimer_docs');
    // Oppenheimer's own text: nothing for the bot to fix.
    expect(result.content).not.toContain('patch_skill');
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
    const existing = skill('triage', {}, 'bot');
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

  it('replaces a skill the person wrote only when they asked, and otherwise writes nothing', async () => {
    const theirs = skill('triage');
    const { call, commandBus } = setup([theirs]);
    const input = { name: 'triage', description: 'Sorts issues.', body: 'Label each.' };
    const unasked = await call('save_skill', input);
    expect(unasked).toMatchObject({ isError: true });
    expect(unasked.content).toContain('Propose the change in your answer instead');
    expect(commandBus.execute).not.toHaveBeenCalled();

    const asked = await call('save_skill', { ...input, asked_by_person: true });
    expect(asked.content).toMatch(/^Updated skill "triage"/);
    expect(commandBus.execute.mock.calls[0]?.[0]).toBeInstanceOf(UpdateBotSkillCommand);
  });

  it('refuses to save under the name of a skill Oppenheimer gives every bot, and saves nothing', async () => {
    const { call, commandBus } = setup([]);
    const result = await call('save_skill', { name: 'recap', description: 'x', body: 'y' });
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain('Oppenheimer uses that name');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('refuses a name that could not be typed after a slash, and saves nothing', async () => {
    const { call, commandBus } = setup([]);
    const result = await call('save_skill', { name: 'Release Notes', description: 'x', body: 'y' });
    expect(result).toMatchObject({ isError: true });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  describe('patch_skill', () => {
    it('fixes one passage of a skill the bot wrote, unasked, as the bot', async () => {
      const own = skill('triage', {}, 'bot');
      const { call, commandBus } = setup([own]);
      const result = await call('patch_skill', {
        name: 'triage',
        old_text: 'Steps',
        new_text: 'Three steps',
      });
      expect(result).toMatchObject({ isError: false });
      expect(result.content).toMatch(/^Fixed skill "triage"/);
      const [command] = commandBus.execute.mock.calls[0];
      expect(command).toBeInstanceOf(UpdateBotSkillCommand);
      expect(command).toMatchObject({
        skillId: own.id,
        author: 'bot',
        change: { body: 'Three steps for triage.' },
      });
    });

    it('refuses to change a skill the person wrote unless they asked, and changes nothing', async () => {
      const { call, commandBus } = setup([skill('triage')]);
      const result = await call('patch_skill', {
        name: 'triage',
        old_text: 'Steps',
        new_text: 'Three steps',
      });
      expect(result).toMatchObject({ isError: true });
      expect(result.content).toContain('Propose the change in your answer instead');
      expect(commandBus.execute).not.toHaveBeenCalled();

      const asked = await call('patch_skill', {
        name: 'triage',
        old_text: 'Steps',
        new_text: 'Three steps',
        asked_by_person: true,
      });
      expect(asked).toMatchObject({ isError: false });
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('never changes a skill Oppenheimer gives every bot, asked or not', async () => {
      const { call, commandBus } = setup([]);
      const result = await call('patch_skill', {
        name: 'recap',
        old_text: 'Recap only reads.',
        new_text: 'Recap reads.',
        asked_by_person: true,
      });
      expect(result).toMatchObject({ isError: true });
      expect(result.content).toContain('Oppenheimer uses that name');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('says why a passage that is not there changes nothing', async () => {
      const { call, commandBus } = setup([skill('triage', {}, 'bot')]);
      const result = await call('patch_skill', {
        name: 'triage',
        old_text: 'pnpm release',
        new_text: 'x',
      });
      expect(result).toMatchObject({ isError: true });
      expect(result.content).toContain('old_text is not in skill "triage"');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('refuses a fix that would take the skill past its limit', async () => {
      const { call, commandBus } = setup([skill('triage', {}, 'bot')]);
      const result = await call('patch_skill', {
        name: 'triage',
        old_text: 'Steps',
        new_text: 'x'.repeat(BOT_SKILL_BODY_MAX),
      });
      expect(result).toMatchObject({ isError: true });
      expect(result.content).toContain(`over ${BOT_SKILL_BODY_MAX} characters`);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  it('deletes a skill by name, and says how many are left', async () => {
    const { call } = setup([skill('triage'), skill('deploy')]);
    expect((await call('delete_skill', { name: 'triage' })).content).toBe(
      'Deleted skill "triage"; you have 1 left.',
    );
  });
});
