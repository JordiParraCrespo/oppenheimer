import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { BOT_AVATAR_COLORS, type BotSection } from '@oppenheimer/shared';
import { CreateBotMemoryFactCommand } from '../../../bots/commands/create-bot-memory-fact/create-bot-memory-fact.command';
import { DeleteBotMemoryFactCommand } from '../../../bots/commands/delete-bot-memory-fact/delete-bot-memory-fact.command';
import { UpdateBotCommand } from '../../../bots/commands/update-bot/update-bot.command';
import { UpdateBotDocumentCommand } from '../../../bots/commands/update-bot-document/update-bot-document.command';
import { BotEntity } from '../../../bots/domain/bot.entity';
import { BotDocumentEntity } from '../../../bots/domain/bot-document.entity';
import { BotMemoryFactEntity } from '../../../bots/domain/bot-memory-fact.entity';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import { FindBotDocumentQuery } from '../../../bots/queries/find-bot-document/find-bot-document.query';
import { FindBotDocumentsQuery } from '../../../bots/queries/find-bot-documents/find-bot-documents.query';
import { FindBotMemoryQuery } from '../../../bots/queries/find-bot-memory/find-bot-memory.query';
import { FindBotMemoryFactQuery } from '../../../bots/queries/find-bot-memory-fact/find-bot-memory-fact.query';
import { BotMessageEntity } from '../../domain/bot-message.entity';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { SearchBotConversationQuery } from '../../queries/search-bot-conversation/search-bot-conversation.query';
import { BotSelfToolsFactory } from '../bot-self-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * The tools a bot shapes itself with: each dispatches the bots module's own
 * command or query as the owner, on the turn's bot and never one named in
 * the input, and answers what was saved by reading it back. `remember` saves
 * only when the bot learns automatically. The commands themselves are the
 * bots module's specs.
 */
const owner = emptyScope('owner-1', 'org-1');
const BOT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_BOT_ID = '22222222-2222-4222-8222-222222222222';
const FACT_ID = '33333333-3333-4333-8333-333333333333';
const context: BotToolContext = {
  owner,
  organizationId: 'org-1',
  botId: BOT_ID,
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'Europe/Madrid',
  permission: 'auto',
  budget: new BotTurnBudget(),
  approvals: { request: vi.fn() },
};

function bot(
  props: { name?: string; learnAutomatically?: boolean; sections?: BotSection[] } = {},
): BotEntity {
  return BotEntity.create({
    id: BOT_ID,
    props: {
      organizationId: 'org-1',
      createdByUserId: 'owner-1',
      name: props.name ?? 'Ada',
      description: 'Keeps the release notes',
      avatarColor: BOT_AVATAR_COLORS[0],
      groupId: null,
      position: 0,
      homeHostId: null,
      provider: 'anthropic',
      model: null,
      effort: null,
      permission: 'auto',
      budget: new BotTurnBudget(),
      learnAutomatically: props.learnAutomatically ?? true,
      sections: props.sections ?? [],
    },
  });
}

function document(name: 'soul' | 'instructions', content: string, revision: number) {
  return BotDocumentEntity.create({
    id: `${BOT_ID}:${name}`,
    props: {
      organizationId: 'org-1',
      botId: BOT_ID,
      name,
      content,
      revision,
      updatedBy: 'user',
      updatedByUserId: 'owner-1',
    },
  });
}

function fact(id: string, content: string) {
  return BotMemoryFactEntity.create({
    id,
    props: { organizationId: 'org-1', botId: BOT_ID, content, source: 'user' },
  });
}

function setup(
  answer: (query: unknown) => unknown,
  onCommand: (command: unknown) => unknown = () => BOT_ID,
) {
  const queryBus = { execute: vi.fn(async (query: unknown) => answer(query)) };
  const commandBus = { execute: vi.fn(async (command: unknown) => onCommand(command)) };
  const factory = new BotSelfToolsFactory(
    queryBus as unknown as QueryBus,
    commandBus as unknown as CommandBus,
  );
  const call = (name: string, input: unknown) => {
    const found = factory.definitions().find((definition) => definition.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found.bind(context).run(input, { signal: new AbortController().signal });
  };
  return { queryBus, commandBus, call };
}

describe('BotSelfToolsFactory', () => {
  it('reads its own profile, settings, both documents with their revisions, and its memory count', async () => {
    const { queryBus, call } = setup((query) => {
      if (query instanceof FindBotQuery) return bot();
      if (query instanceof FindBotDocumentsQuery)
        return [document('soul', 'Calm.', 3), document('instructions', 'x'.repeat(5_000), 2)];
      if (query instanceof FindBotMemoryQuery) return [fact(FACT_ID, 'Likes tea')];
    });

    const result = await call('get_self', {});

    for (const [query] of queryBus.execute.mock.calls) {
      expect(query).toMatchObject({ scope: owner, botId: BOT_ID });
    }
    expect(result.content).toContain(`You: ${BOT_ID} "Ada"`);
    expect(result.content).toContain('learn automatically: on');
    expect(result.content).toContain('memory: 1 of 200 facts');
    expect(result.content).toContain('SOUL.md (revision 3');
    expect(result.content).toContain('INSTRUCTIONS.md (revision 2, 5000 characters');
    expect(result.content).toContain('1000 more characters cut');
  });

  it('saves a document over the revision it read, marked as the bot’s, and confirms the new revision', async () => {
    const { commandBus, call } = setup((query) => {
      if (query instanceof FindBotDocumentQuery) return document('instructions', 'Ship notes.', 5);
    });

    const result = await call('edit_instructions', {
      content: 'Ship notes.',
      base_revision: 4,
      note: 'tighter scope',
    });

    const command = commandBus.execute.mock.calls[0][0] as UpdateBotDocumentCommand;
    expect(command).toBeInstanceOf(UpdateBotDocumentCommand);
    expect(command).toMatchObject({
      scope: owner,
      botId: BOT_ID,
      name: 'instructions',
      input: { content: 'Ship notes.', baseRevision: 4, note: 'By the bot: tighter scope' },
    });
    expect(result.content).toContain('INSTRUCTIONS.md saved as revision 5');
  });

  it('reads a stale save back as the conflict, so the bot re-reads before writing again', async () => {
    const { call } = setup(
      () => undefined,
      () => {
        throw new AppError(
          { code: 'BOT_004', message: 'Document changed since it was read', httpStatus: 409 },
          { detail: 'soul is at revision 6, not 4' },
        );
      },
    );
    const result = await call('edit_soul', { content: 'Warm.', base_revision: 4 });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('soul is at revision 6, not 4');
  });

  it('edits only its own profile: a bot id in the input is refused and nothing is dispatched', async () => {
    const { queryBus, commandBus, call } = setup(() => bot());
    const result = await call('update_profile', { bot_id: OTHER_BOT_ID, name: 'Mallory' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/^Invalid input: .*bot_id/);
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(queryBus.execute).not.toHaveBeenCalled();
  });

  it('renames itself and confirms the change from the saved bot', async () => {
    let saved = false;
    const { commandBus, call } = setup(
      () => bot({ name: saved ? 'Ada Lovelace' : 'Ada' }),
      () => {
        saved = true;
        return BOT_ID;
      },
    );
    const result = await call('update_profile', { name: 'Ada Lovelace' });
    const command = commandBus.execute.mock.calls[0][0] as UpdateBotCommand;
    expect(command).toBeInstanceOf(UpdateBotCommand);
    expect(command).toMatchObject({ scope: owner, botId: BOT_ID, input: { name: 'Ada Lovelace' } });
    expect(result.content).toBe('Profile saved: name "Ada" → "Ada Lovelace".');
  });

  it('places itself in console sections and confirms the set from the saved bot', async () => {
    let saved = false;
    const { commandBus, call } = setup(
      () => bot({ sections: saved ? ['sessions', 'pulls'] : [] }),
      () => {
        saved = true;
        return BOT_ID;
      },
    );
    const result = await call('update_profile', { sections: ['pulls', 'sessions'] });
    const command = commandBus.execute.mock.calls[0][0] as UpdateBotCommand;
    expect(command).toMatchObject({ input: { sections: ['pulls', 'sessions'] } });
    expect(result.content).toBe('Profile saved: sections [] → [sessions, pulls].');
  });

  it('refuses a section the console does not have, and dispatches nothing', async () => {
    const { commandBus, call } = setup(() => bot());
    const result = await call('update_profile', { sections: ['inbox'] });
    expect(result.isError).toBe(true);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('remembers a fact when it learns automatically, and confirms what was saved', async () => {
    const { commandBus, call } = setup(
      (query) => {
        if (query instanceof FindBotQuery) return bot();
        if (query instanceof FindBotMemoryFactQuery)
          return fact(FACT_ID, 'Deploys go out on Fridays');
      },
      () => FACT_ID,
    );
    const result = await call('remember', { fact: 'Deploys go out on Fridays' });
    const command = commandBus.execute.mock.calls[0][0] as CreateBotMemoryFactCommand;
    expect(command).toBeInstanceOf(CreateBotMemoryFactCommand);
    expect(command).toMatchObject({
      scope: owner,
      botId: BOT_ID,
      content: 'Deploys go out on Fridays',
    });
    expect(result.content).toContain(`Remembered ${FACT_ID}: "Deploys go out on Fridays"`);
  });

  it('does not remember when learning is off: nothing is saved and it is told to ask first', async () => {
    const { commandBus, call } = setup(() => bot({ learnAutomatically: false }));
    const result = await call('remember', { fact: 'Deploys go out on Fridays' });
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    expect(result.content).toMatch(/^Not saved: .*needs the person's OK/);
  });

  it('forgets one of its own facts and says which', async () => {
    const { queryBus, commandBus, call } = setup(() => fact(FACT_ID, 'Likes tea'));
    const result = await call('forget', { fact_id: FACT_ID });
    expect(queryBus.execute.mock.calls[0][0]).toMatchObject({ botId: BOT_ID, factId: FACT_ID });
    const command = commandBus.execute.mock.calls[0][0] as DeleteBotMemoryFactCommand;
    expect(command).toBeInstanceOf(DeleteBotMemoryFactCommand);
    expect(command).toMatchObject({ scope: owner, botId: BOT_ID, factId: FACT_ID });
    expect(result.content).toBe(`Forgot ${FACT_ID}: "Likes tea".`);
  });

  it('recalls the facts matching most words first, and says so when none match', async () => {
    const { call } = setup(() => [
      fact('44444444-4444-4444-8444-444444444444', 'Staging is on build-01'),
      fact('55555555-5555-4555-8555-555555555555', 'Deploy staging after the tests pass'),
      fact(FACT_ID, 'Likes tea'),
    ]);

    const found = (await call('recall', { query: 'deploy STAGING' })).content;
    expect(found).toContain('Facts matching "deploy STAGING" (2)');
    expect(found.indexOf('Deploy staging')).toBeLessThan(found.indexOf('Staging is on'));
    expect(found).not.toContain('Likes tea');

    expect((await call('recall', { query: 'coffee' })).content).toBe(
      'No fact contains any of those words (you hold 3).',
    );
  });

  // What breaks this: a search reaching another bot's chat or another
  // person's scope, or a hit shown as instructions rather than fenced data.
  it('searches its own chat in the owner’s scope and fences what it found as data', async () => {
    const said = (role: 'user' | 'assistant', content: string) =>
      BotMessageEntity.createNew({
        organizationId: 'org-1',
        botId: BOT_ID,
        turnId: 'turn-0',
        role,
        content,
        steps: [],
        position: 0,
      });
    const { queryBus, call } = setup((query) =>
      query instanceof SearchBotConversationQuery
        ? [
            said('user', 'The staging host is build-02'),
            said('assistant', 'Noted: staging is build-02'),
          ]
        : [],
    );

    const found = (await call('search_chat', { query: 'staging host' })).content;

    const [query] = queryBus.execute.mock.calls[0] ?? [];
    expect(query).toMatchObject({ scope: owner, botId: BOT_ID, query: 'staging host', limit: 10 });
    expect(found).toContain('Messages matching "staging host" (2');
    expect(found).toMatch(/<chat_search>\n- .+ the person: The staging host is build-02/);
    expect(found).toContain('you: Noted: staging is build-02');
  });

  it('says plainly when nothing in the chat matches', async () => {
    const { call } = setup(() => []);
    expect((await call('search_chat', { query: 'coffee' })).content).toBe(
      'No message in this chat matches "coffee". Try other words, or fewer.',
    );
  });

  it('answers bad input as an error the model can correct, dispatching nothing', async () => {
    const { queryBus, commandBus, call } = setup(() => bot());
    const result = await call('remember', { fact: 'x'.repeat(501) });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/^Invalid input: fact/);
    expect(queryBus.execute).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
