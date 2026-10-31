import { Inject, Injectable } from '@nestjs/common';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import { botDefaultModel, type Scope } from '@oppenheimer/shared';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { BotLookupPort } from '../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../bots/bots.di-tokens';
import { BotErrors } from '../../bots/domain/bots.errors';
import { BOT_QUESTION_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotQuestionRepositoryPort } from '../database/bot-question.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import { intersectScopes } from '../domain/bot-approval.policy';
import type { BotQuestionEntity } from '../domain/bot-question.entity';
import { questionTurn } from '../domain/bot-question.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';

/** Who decides a card of questions, and how the bot is told. */
export interface BotQuestionDecider {
  scope: AccessScope;
  botId: string;
  questionId: string;
  /** Who decided, as the bot is told: the caller's name. */
  name: string;
  /** The deciding credential's scopes; null for a browser session. */
  credentialScopes: readonly Scope[] | null;
  correlationId: string | null;
}

/**
 * What answering and dismissing a card of questions share (`25-bots.md`
 * §3.2): the card is found in the caller's workspace and still pending, the
 * decision is a conditional write on `pending`, so a second click or one
 * racing a new message loses with `BOTS_037`, and the bot's next turn,
 * opened by what was decided, commits with it under the scopes both the
 * asking turn and the deciding credential cover.
 */
@Injectable()
export class BotQuestionDecisionResolver {
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_QUESTION_REPOSITORY) private readonly questions: BotQuestionRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async decide(
    decider: BotQuestionDecider,
    apply: (question: BotQuestionEntity) => void,
  ): Promise<string> {
    const { scope, credentialScopes } = decider;
    const bot = await this.lookup.bot(scope, decider.botId);
    const question = requireFound(
      await this.questions.findOne(scope, bot.id, decider.questionId),
      BotErrors.QUESTION_NOT_FOUND,
    );
    if (question.status !== 'pending') throw new AppError(BotErrors.QUESTION_DECIDED);
    apply(question);
    const found = await this.turns.findOne(scope, bot.id, question.turnId);
    const asked = found.isSome() ? found.unwrap() : null;
    const continuation = questionTurn(
      {
        organizationId: bot.organizationId,
        botId: bot.id,
        requestedByUserId: scope.userId,
        provider: bot.provider,
        model: bot.model ?? botDefaultModel(bot.provider).id,
        effort: bot.effort,
        timeZone: asked?.timeZone ?? null,
        credentialScopes: intersectScopes(asked ? asked.credentialScopes : [], credentialScopes),
      },
      question,
      decider.name,
    );
    if (!(await this.questions.saveTransition(question, continuation, decider.correlationId))) {
      throw new AppError(BotErrors.QUESTION_DECIDED);
    }
    await this.stream.publish(bot.id, {
      type: 'question',
      questionId: question.id,
      status: question.status,
    });
    await this.stream.publish(bot.id, {
      type: 'turn',
      turnId: continuation.turn.id,
      status: 'queued',
    });
    return question.id;
  }
}
