import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { parseBotSlashCommand } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import type { TurnCredentialsPort } from '../../../bots/application/turn-credentials.port';
import type { BotRepositoryPort } from '../../../bots/database/bot.repository.port';
import type { BotDocumentRepositoryPort } from '../../../bots/database/bot-document.repository.port';
import type { BotMemoryFactRepositoryPort } from '../../../bots/database/bot-memory-fact.repository.port';
import type { BotSkillRepositoryPort } from '../../../bots/database/bot-skill.repository.port';
import type { PersonMemoryRepositoryPort } from '../../../bots/database/person-memory.repository.port';
import { BotSkillEntity } from '../../../bots/domain/bot-skill.entity';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotConversationRepositoryPort } from '../../database/bot-conversation.repository.port';
import type { BotConversationSummaryRepositoryPort } from '../../database/bot-conversation-summary.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotApprovalEntity } from '../../domain/bot-approval.entity';
import { BotConversationSummaryEntity } from '../../domain/bot-conversation-summary.entity';
import { BotMessageEntity } from '../../domain/bot-message.entity';
import { telegramTurn } from '../../domain/bot-telegram-turn.policy';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import {
  BOT_TURN_MAX_STEPS,
  type BotTurnContext,
  BotTurnEntity,
} from '../../domain/bot-turn.entity';
import type { OwnerHostsPort } from '../../infrastructure/owner-hosts.port';
import type { BotApprovalRequestFactory } from '../bot-approval-request.factory';
import { BotApprovalStartedPolicy } from '../bot-approval-started.policy';
import { BotModelAccessResolver } from '../bot-model-access.resolver';
import type { BotOwnerPermissionsResolver } from '../bot-owner-permissions.resolver';
import type { BotOwnerScopeResolver } from '../bot-owner-scope.resolver';
import type { BotPermissionsResolver } from '../bot-permissions.resolver';
import type { BotRuleReviewerFactory } from '../bot-rule-reviewer.factory';
import type { BotSubagentRunnerFactory } from '../bot-subagent-runner.factory';
import type { BotToolboxFactory } from '../bot-toolbox.factory';
import { BotTurnContextResolver } from '../bot-turn-context.resolver';
import type { BotTurnOpeningResolver } from '../bot-turn-opening.resolver';

/**
 * How a turn's moment is read and where it goes: the owner's hosts in their
 * scope, the home host named among them, a refusal from the hosts module
 * read as "unknown" (the turn still runs), and any other failure failing the
 * turn rather than being hidden; all of it in the block that opens this
 * turn's message, so the system prompt is the same bytes on every turn of an
 * unchanged bot and the provider's prompt cache hits. The reads of the bot's
 * own rows are the integration spec's.
 */
const HOME = '11111111-1111-4111-8111-111111111111';

function skill(
  name: string,
  invocable: { userInvocable?: boolean; modelInvocable?: boolean } = {},
): BotSkillEntity {
  return BotSkillEntity.createNew({
    organizationId: 'org-1',
    botId: 'bot-1',
    name,
    description: `Does ${name}.`,
    body: `Steps for ${name}.`,
    ...invocable,
    actor: { kind: 'user', userId: 'owner-1' },
  });
}

function setup(
  hostsOf: OwnerHostsPort['hostsOf'],
  conversation: {
    summary?: BotConversationSummaryEntity;
    findHistory?: BotMessageRepositoryPort['findHistory'];
    lastContext?: BotTurnContext;
    /** What the person wrote; a `/<name>` runs that skill. */
    opening?: string;
    skills?: BotSkillEntity[];
    /** The tools the prompt lists, by name. */
    offered?: string[];
    /** What opened the turn, when it is not a message of yours. */
    message?: BotMessageEntity;
    /** The approval it names, as the worker reads it. */
    approval?: 'running' | 'ran';
    /** What the owner wrote about themselves in Settings → Memory. */
    about?: string;
  } = {},
) {
  const opening = conversation.opening ?? 'Hi';
  const skills = conversation.skills ?? [];
  const offered = (conversation.offered ?? []).map((name) => ({ name, description: `${name}.` }));
  const owner = emptyScope('owner-1', 'org-1');
  const bot = {
    id: 'bot-1',
    name: 'Ops',
    description: '',
    createdByUserId: 'owner-1',
    homeHostId: HOME,
    permission: 'auto',
  };
  const access = new BotModelAccessResolver(
    { findForTurn: async () => Some(bot) } as unknown as BotRepositoryPort,
    {
      forTurn: async () => ({ apiKey: 'key' }),
      has: async () => true,
    } satisfies TurnCredentialsPort,
  );
  const resolver = new BotTurnContextResolver(
    access,
    { findAllForTurn: async () => [] } as unknown as BotDocumentRepositoryPort,
    { findAllForTurn: async () => [] } as unknown as BotMemoryFactRepositoryPort,
    { findAllForTurn: async () => skills } as unknown as BotSkillRepositoryPort,
    {
      find: async (organizationId: string, userId: string) => ({
        organizationId,
        userId,
        about: userId === 'owner-1' ? (conversation.about ?? '') : 'Not the owner.',
        updatedAt: null,
      }),
    } as unknown as PersonMemoryRepositoryPort,
    {
      findHistory: conversation.findHistory ?? (async () => []),
    } as unknown as BotMessageRepositoryPort,
    {
      findForBot: async () => (conversation.summary ? Some(conversation.summary) : None),
    } as unknown as BotConversationSummaryRepositoryPort,
    { resolve: async () => owner } as unknown as BotOwnerScopeResolver,
    { hostsOf: vi.fn(hostsOf) },
    {
      findLastContext: async () => conversation.lastContext ?? null,
    } satisfies Pick<BotTurnRepositoryPort, 'findLastContext'> as unknown as BotTurnRepositoryPort,
    {
      findTelegram: async () => null,
    } as unknown as BotConversationRepositoryPort,
    {
      tools: () => [
        {
          name: 'archive_mail',
          description: 'Archive.',
          inputSchema: { type: 'object' },
          run: async () => ({ content: 'Archived 25 threads.' }),
        },
      ],
      readOnlyTools: () => [],
      catalog: () => offered,
    } as unknown as BotToolboxFactory,
    {} as BotApprovalRequestFactory,
    { heldScopes: async () => new Set() } as unknown as BotOwnerPermissionsResolver,
    {
      resolve: async () => ({
        prompt: opening,
        images: [],
        command: parseBotSlashCommand(opening),
        message: conversation.message ?? null,
      }),
    } as unknown as BotTurnOpeningResolver,
    { create: () => ({ run: async () => [] }) } as unknown as BotSubagentRunnerFactory,
    { forBot: async () => NO_PERMISSIONS } as unknown as BotPermissionsResolver,
    {
      create: () => ({ review: async () => ({ effect: 'none' }) }),
    } as unknown as BotRuleReviewerFactory,
    new BotApprovalStartedPolicy({
      findForRun: async () =>
        Some({ running: conversation.approval !== 'ran' } as BotApprovalEntity),
    } as unknown as BotApprovalRepositoryPort),
  );
  const turnFrom = (timeZone: string | null) =>
    BotTurnEntity.queue({
      organizationId: 'org-1',
      botId: 'bot-1',
      requestedByUserId: 'owner-1',
      provider: 'glm',
      model: 'model-1',
      effort: null,
      timeZone,
    });
  const shape = (at = new Date('2026-10-15T09:00:00Z'), timeZone: string | null = null) =>
    resolver.resolve(turnFrom(timeZone), at);
  return {
    shape,
    resolver,
    /** What the engine is sent, for a turn that runs. */
    resolve: async (at?: Date, timeZone: string | null = null) => {
      const shaped = await shape(at, timeZone);
      if (!shaped) throw new Error('the turn had nothing to say');
      return shaped.request;
    },
  };
}

describe('BotTurnContextResolver', () => {
  // What breaks this: the turn a yes opens read like any other, so it acts
  // before the call it approved reports, or says "on it" after the report.
  it('hands every turn to the approval-started policy: a message of yours runs as read', async () => {
    const usual = await setup(async () => []).shape();
    expect(usual?.takesSteers).toBe(true);
    expect(usual?.request.maxSteps).toBe(BOT_TURN_MAX_STEPS);

    const started = BotMessageEntity.createNew({
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 't-1',
      role: 'event',
      content: 'Ana approved: Archive 25 threads\nIt is running now.',
      event: {
        kind: 'approval',
        outcome: 'approved',
        tool: 'archive_mail',
        summary: 'Archive 25 threads',
        sessionId: null,
        approvalId: 'a-1',
        stage: 'started',
      },
      steps: [],
      position: 0,
    });
    const onIt = await setup(async () => [], { message: started }).shape();
    expect(onIt?.takesSteers).toBe(false);
    await expect(
      setup(async () => [], { message: started, approval: 'ran' }).shape(),
    ).resolves.toBe(null);
  });

  // What breaks this: the text the person wrote in Settings → Memory is saved
  // but never read, or read as someone else's, so every bot asks again who
  // they are.
  it('puts what the owner wrote about themselves in the system prompt, and nothing when they wrote nothing', async () => {
    const written = await setup(async () => [], {
      about: 'I am Jordi. Answer in short sentences.',
    }).resolve();
    expect(written.systemPrompt).toContain(
      '# About the person, in their own words (they wrote it; you cannot change it)\n\nI am Jordi. Answer in short sentences.',
    );

    const blank = await setup(async () => []).resolve();
    expect(blank.systemPrompt).not.toContain('About the person, in their own words');
  });

  // What breaks this: a Telegram turn queued before its Telegram bot was
  // disconnected running anyway, with the owner's tools, for nobody.
  it('ends a Telegram turn at once when its Telegram bot was disconnected', async () => {
    const { resolver } = setup(async () => []);
    const { turn } = telegramTurn(
      {
        organizationId: 'org-1',
        botId: 'bot-1',
        requestedByUserId: 'owner-1',
        provider: 'glm',
        model: 'model-1',
        effort: null,
      },
      {
        conversationId: '0b3e2a1c-5555-4c5d-8e6f-70819203b4c5',
        telegramAccountId: '0b3e2a1c-6666-4c5d-8e6f-70819203b4c5',
        chatId: '1',
        messageId: '2',
        text: 'Hi',
      },
    );
    expect(await resolver.resolve(turn, new Date())).toBeNull();
  });

  it('names the home host among the owner’s hosts', async () => {
    const { resolve } = setup(async () => [
      { id: HOME, name: 'build-01', online: true, runningSessions: 1 },
    ]);
    expect((await resolve()).message).toContain('Your home host is build-01 (online)');
  });

  it('opens the message with the turn context and ends it with what the person wrote', async () => {
    const { resolve } = setup(async () => []);
    const { message } = await resolve(new Date('2026-10-15T09:00:00Z'), 'Europe/Madrid');
    expect(message).toMatch(
      /^<turn_context>\nIt is Thursday, 15 October 2026, 11:00 \(Europe\/Madrid/,
    );
    expect(message.endsWith('</turn_context>\n\nHi')).toBe(true);
  });

  it('tells the turn how full its context was when the last turn ended, in the message, not the prompt', async () => {
    const { resolve } = setup(async () => [], {
      lastContext: { tokens: 120_000, window: 200_000 },
    });
    const { message, systemPrompt } = await resolve(new Date('2026-10-15T09:00:00Z'), null);
    expect(message).toContain('Your context was 60% full at the end of your last turn');
    expect(systemPrompt).not.toContain('Your context was');
  });

  // What breaks this: a prompt or a cache key that moves between turns, so
  // the provider's prompt cache never holds the conversation's prefix.
  it('composes the same system prompt and cache key on two turns apart in time, zone and hosts', async () => {
    const hosts = vi
      .fn<OwnerHostsPort['hostsOf']>()
      .mockResolvedValueOnce([{ id: HOME, name: 'build-01', online: true, runningSessions: 1 }])
      .mockResolvedValueOnce([
        { id: HOME, name: 'build-01', online: false, runningSessions: 0 },
        { id: 'other', name: 'old-laptop', online: true, runningSessions: 2 },
      ]);
    const { resolve } = setup(hosts);
    const first = await resolve(new Date('2026-10-15T09:00:00Z'), 'Europe/Madrid');
    const second = await resolve(new Date('2026-10-16T21:37:00Z'), 'America/New_York');
    expect(second.systemPrompt).toBe(first.systemPrompt);
    expect(first.cacheKey).toBe('bot-1');
    expect(second.cacheKey).toBe(first.cacheKey);
    expect(second.message).not.toBe(first.message);
    expect(second.message).toContain('old-laptop');
  });

  it('runs the turn when the hosts module refuses, saying the hosts are unknown', async () => {
    const { resolve } = setup(async () => {
      throw new AppError({
        code: 'HOSTS_004',
        message: 'Hosts are not configured',
        httpStatus: 503,
      });
    });
    expect((await resolve()).message).toContain("The person's hosts could not be read just now");
  });

  it('fails the turn on any other failure, rather than hiding it', async () => {
    const { resolve } = setup(async () => {
      throw new TypeError('broken');
    });
    await expect(resolve()).rejects.toThrow('broken');
  });
  it('sends the summary first, then the messages after its cutoff, read from there', async () => {
    const summary = BotConversationSummaryEntity.first({
      organizationId: 'org-1',
      botId: 'bot-1',
      content: 'The person deploys from build-01.',
      through: { id: 'm-cut', createdAt: new Date('2026-10-14T09:00:00Z') },
    });
    const findHistory = vi.fn<BotMessageRepositoryPort['findHistory']>(async () => [
      BotMessageEntity.createNew({
        organizationId: 'org-1',
        botId: 'bot-1',
        turnId: 'turn-0',
        role: 'user',
        content: 'Deploy again?',
        steps: [],
        position: 0,
      }),
    ]);
    const { resolve } = setup(async () => [], { summary, findHistory });
    const { history } = await resolve();
    expect(findHistory).toHaveBeenCalledWith(
      'org-1',
      'bot-1',
      expect.any(String),
      'm-cut',
      expect.any(Number),
    );
    expect(history).toHaveLength(2);
    expect(history[0].text).toContain('The person deploys from build-01.');
    expect(history[1]).toEqual({ role: 'user', text: 'Deploy again?' });
  });

  describe('skills', () => {
    it('lists the skills the bot may use, by name and description and never their body, when it can read one', async () => {
      const { resolve } = setup(async () => [], {
        offered: ['use_skill'],
        skills: [
          skill('triage'),
          skill('release-notes'),
          skill('deploy', { modelInvocable: false }),
        ],
      });
      const { systemPrompt } = await resolve();
      expect(systemPrompt).toContain('# Your skills\n\nWays of doing a task');
      expect(systemPrompt).toContain(
        '- `release-notes`: Does release-notes.\n- `triage`: Does triage.',
      );
      expect(systemPrompt).not.toContain('Steps for');
      // Only the person runs it, so the bot is not offered it.
      expect(systemPrompt).not.toContain('`deploy`');
    });

    it('lists none when the turn cannot read a skill', async () => {
      const { resolve } = setup(async () => [], { skills: [skill('triage')] });
      expect((await resolve()).systemPrompt).not.toContain('# Your skills');
    });

    it('runs the skill a person names with /<name>: its body opens the message, their words after it', async () => {
      const { resolve } = setup(async () => [], {
        opening: '/release-notes v2.3',
        skills: [skill('release-notes', { modelInvocable: false })],
      });
      const { message, systemPrompt } = await resolve();
      expect(message).toContain(
        'The person ran your skill /release-notes. Follow it for this request. What they wrote after the command is its input.\n\n<skill name="release-notes">\nSteps for release-notes.\n</skill>\n\n/release-notes v2.3',
      );
      // The prompt stays the same bytes: the skill rides this turn's message only.
      expect(systemPrompt).not.toContain('Steps for release-notes.');
    });

    it('says a command is no skill of its, and names the ones the person can run', async () => {
      const { resolve } = setup(async () => [], {
        opening: '/relase-notes',
        skills: [skill('release-notes'), skill('triage', { userInvocable: false })],
      });
      const { message } = await resolve();
      expect(message).toContain(
        'The message starts with /relase-notes, which is not one of your skills. The skills they can run are /recap, /release-notes.',
      );
      expect(message).not.toContain('<skill');
    });

    it('does not run a skill only the bot may use, from a command', async () => {
      const { resolve } = setup(async () => [], {
        opening: '/triage',
        skills: [skill('triage', { userInvocable: false })],
      });
      const { message } = await resolve();
      expect(message).not.toContain('<skill');
      expect(message).toContain('The skills they can run are /recap.');
    });

    it('runs the built-in /recap for a bot with no skills of its own, the person’s topic as its input', async () => {
      const { resolve } = setup(async () => [], { opening: '/recap the billing work' });
      const { message } = await resolve();
      expect(message).toContain(
        'The person ran your skill /recap. Follow it for this request. What they wrote after the command is its input.\n\n<skill name="recap">',
      );
      expect(message).toContain('/recap the billing work');
      expect(message).not.toContain('not one of your skills');
    });

    it('runs a skill of the bot’s own saved as recap before the name was reserved, not the built-in', async () => {
      const saved = skill('notes', { modelInvocable: false });
      const reserved = BotSkillEntity.create({
        id: saved.id,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        props: { ...saved.getProps(), name: 'recap', body: 'Steps for recap.' },
      });
      const { resolve } = setup(async () => [], { opening: '/recap', skills: [reserved] });
      const { message } = await resolve();
      expect(message).toContain('<skill name="recap">\nSteps for recap.\n</skill>');
    });
  });
});
