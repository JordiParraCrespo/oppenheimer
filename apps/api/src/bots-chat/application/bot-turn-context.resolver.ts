import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type BotEffort,
  type BotTurnRequest,
  engineCapabilities,
} from '@oppenheimer/backend-agents';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { BOT_DOCUMENT_REPOSITORY, BOT_MEMORY_FACT_REPOSITORY } from '../../bots/bots.di-tokens';
import type { BotDocumentRepositoryPort } from '../../bots/database/bot-document.repository.port';
import type { BotMemoryFactRepositoryPort } from '../../bots/database/bot-memory-fact.repository.port';
import {
  BOT_CONVERSATION_SUMMARY_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_TURN_REPOSITORY,
  OWNER_HOSTS,
} from '../bots-chat.di-tokens';
import type { BotConversationSummaryRepositoryPort } from '../database/bot-conversation-summary.repository.port';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import { BOT_HISTORY_READ_MAX, botHistory } from '../domain/bot-history.policy';
import { withEarlierImages } from '../domain/bot-image.policy';
import { composeBotSystemPrompt } from '../domain/bot-prompt.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotTurnBudget } from '../domain/bot-turn-budget.policy';
import { composeTurnContext, withTurnContext } from '../domain/bot-turn-context.policy';
import type { OwnerHost, OwnerHostsPort } from '../infrastructure/owner-hosts.port';
import { BotApprovalRequestFactory } from './bot-approval-request.factory';
import { BotModelAccessResolver } from './bot-model-access.resolver';
import { BotOwnerPermissionsResolver } from './bot-owner-permissions.resolver';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';
import { BotPermissionsResolver } from './bot-permissions.resolver';
import { BotRuleReviewerFactory } from './bot-rule-reviewer.factory';
import { BotSubagentRunnerFactory } from './bot-subagent-runner.factory';
import type { BotToolContext } from './bot-tool.factory';
import { BotToolboxFactory } from './bot-toolbox.factory';
import { BotTurnOpeningResolver } from './bot-turn-opening.resolver';

const ENGINE_EFFORTS: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** What a turn is run with, but the abort signal and the scratch directory its runner owns. */
export type BotTurnContext = Omit<BotTurnRequest, 'signal' | 'scratchDir'>;

/**
 * Model round trips in one chat turn. Below the engine's default: a chat
 * turn answers, and longer work belongs to a session on a host.
 */
export const BOT_TURN_MAX_STEPS = 20;

/**
 * Everything a turn needs, read when it starts: the bot as it is now (its
 * soul, instructions and memory become the system prompt, the same from turn
 * to turn while they are), the conversation before this turn (its summary,
 * then the newest messages after it that fit the history budget), the
 * credential the turn's provider runs on (a key, or a refreshed sign-in),
 * and this turn's message with its images, its words opened by the moment
 * it runs in: the sender's time, the bot's home host and the owner's hosts,
 * read in the owner's scope, and how full its context was when its last
 * turn ended. The bot's own rows are read by the turn's
 * workspace; what the owner can reach is read as the owner, so the bot sees
 * no more than they do.
 */
@Injectable()
export class BotTurnContextResolver {
  constructor(
    private readonly access: BotModelAccessResolver,
    @Inject(BOT_DOCUMENT_REPOSITORY) private readonly documents: BotDocumentRepositoryPort,
    @Inject(BOT_MEMORY_FACT_REPOSITORY) private readonly memory: BotMemoryFactRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_CONVERSATION_SUMMARY_REPOSITORY)
    private readonly summaries: BotConversationSummaryRepositoryPort,
    private readonly owners: BotOwnerScopeResolver,
    @Inject(OWNER_HOSTS) private readonly hosts: OwnerHostsPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    private readonly toolbox: BotToolboxFactory,
    private readonly approvals: BotApprovalRequestFactory,
    private readonly permissions: BotOwnerPermissionsResolver,
    private readonly opening: BotTurnOpeningResolver,
    private readonly subagents: BotSubagentRunnerFactory,
    private readonly settings: BotPermissionsResolver,
    private readonly reviewers: BotRuleReviewerFactory,
  ) {}

  private readonly logger = new Logger(BotTurnContextResolver.name);

  async resolve(turn: BotTurnEntity, now: Date): Promise<BotTurnContext> {
    const { prompt, images } = await this.opening.resolve(turn);
    const bot = await this.access.bot(turn.organizationId, turn.botId);
    const credential = await this.access.credential(turn.organizationId, turn.provider, now);
    const owner = await this.owners.resolve(turn.organizationId, bot.createdByUserId);
    const summarized = await this.summaries.findForBot(turn.organizationId, bot.id);
    const summary = summarized.isSome() ? summarized.unwrap() : null;
    const [documents, facts, earlier, hosts, lastContext, permissions] = await Promise.all([
      this.documents.findAllForTurn(turn.organizationId, bot.id),
      this.memory.findAllForTurn(turn.organizationId, bot.id),
      this.messages.findHistory(
        turn.organizationId,
        bot.id,
        turn.id,
        summary?.coversThroughMessageId ?? null,
        BOT_HISTORY_READ_MAX,
      ),
      this.hostsOf(owner, turn.id),
      this.turns.findLastContext(turn.organizationId, bot.id),
      this.settings.forBot(turn.organizationId, bot.id),
    ]);
    const model = {
      provider: turn.provider,
      ...credential,
      model: turn.model,
      effort: ENGINE_EFFORTS.includes(turn.effort ?? '') ? (turn.effort as BotEffort) : null,
    };
    // An owner who can no longer act leaves the bot nothing to act through.
    let tools: BotTurnContext['tools'] = [];
    if (owner) {
      const held = () => this.permissions.heldScopes(owner);
      const context: BotToolContext = {
        owner,
        organizationId: turn.organizationId,
        botId: bot.id,
        turnId: turn.id,
        homeHostId: bot.homeHostId,
        timeZone: turn.timeZone ?? 'UTC',
        permission: bot.permission,
        budget: new BotTurnBudget(),
        credentialScopes: turn.credentialScopes,
        approvals: this.approvals,
        permissions,
        // The owner's rules are read on the turn's own model, only when there are some.
        ...(permissions.rules.length > 0 && { reviewer: this.reviewers.create(model) }),
      };
      // A child runs on the turn's model and key, with the turn's read-only
      // tools and its budget: it reaches no further than the bot does.
      const childTools = this.toolbox.readOnlyTools(context, turn.credentialScopes, held);
      const subagents = this.subagents.create(model, bot.name, childTools);
      tools = this.toolbox.tools({ ...context, subagents }, turn.credentialScopes, held);
    }
    const documentText = (name: string) =>
      documents.find((document) => document.name === name)?.content ?? '';
    return {
      ...model,
      systemPrompt: composeBotSystemPrompt({
        name: bot.name,
        description: bot.description,
        soul: documentText('soul'),
        instructions: documentText('instructions'),
        facts: [...facts].reverse().map((fact) => fact.content),
        engineCapabilities: engineCapabilities(turn.provider),
        tools: owner
          ? this.toolbox.catalog(turn.credentialScopes, { preset: bot.permission, permissions })
          : [],
      }),
      history: botHistory(earlier.map(withEarlierImages), summary?.content ?? null),
      message: withTurnContext(
        composeTurnContext({
          now,
          timeZone: turn.timeZone,
          homeHost: hosts?.find((host) => host.id === bot.homeHostId) ?? null,
          hosts,
          lastContext,
        }),
        prompt,
      ),
      images,
      tools,
      maxSteps: BOT_TURN_MAX_STEPS,
    };
  }

  /**
   * The owner's hosts, or null when the hosts module refuses to say: the
   * turn still runs, and the turn context says the hosts are unknown rather than
   * that there are none. Anything else the read throws is a fault, and
   * fails the turn like any other.
   */
  private async hostsOf(owner: AccessScope | null, turnId: string): Promise<OwnerHost[] | null> {
    if (!owner) return null;
    try {
      return await this.hosts.hostsOf(owner);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      this.logger.warn({
        message: 'A bot turn could not read its hosts',
        turnId,
        code: error.code,
      });
      return null;
    }
  }
}
