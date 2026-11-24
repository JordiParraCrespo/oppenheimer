import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import { botDefaultModel, type Scope } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../bots/bots.di-tokens';
import { BotErrors } from '../../bots/domain/bots.errors';
import { BOT_FORM_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotFormRepositoryPort } from '../database/bot-form.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import { intersectScopes } from '../domain/bot-approval.policy';
import type { BotFormEntity } from '../domain/bot-form.entity';
import { formTurn } from '../domain/bot-form.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';

/** Who decides a form, and how the bot is told. */
export interface BotFormDecider {
  scope: AccessScope;
  botId: string;
  formId: string;
  /** Who decided, as the bot is told: the caller's name. */
  name: string;
  /** The deciding credential's scopes; null for a browser session. */
  credentialScopes: readonly Scope[] | null;
  correlationId: string | null;
}

/**
 * What submitting and dismissing a form share: the form is found in the
 * caller's workspace and still pending, the decision is a conditional write
 * on `pending`, so a second click or one racing a new message loses with
 * `BOTS_048`, and the bot's next turn, opened by what was decided, commits
 * with it under the scopes both the asking turn and the deciding credential
 * cover.
 */
@Injectable()
export class BotFormDecisionResolver {
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_FORM_REPOSITORY) private readonly forms: BotFormRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async decide(decider: BotFormDecider, apply: (form: BotFormEntity) => void): Promise<string> {
    const { scope, credentialScopes } = decider;
    const bot = await this.lookup.bot(scope, decider.botId);
    const form = requireFound(
      await this.forms.findOne(scope, bot.id, decider.formId),
      BotErrors.FORM_NOT_FOUND,
    );
    if (form.status !== 'pending') throw new AppError(BotErrors.FORM_DECIDED);
    apply(form);
    const found = await this.turns.findOne(scope, bot.id, form.turnId);
    const asked = found.isSome() ? found.unwrap() : null;
    const continuation = formTurn(
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
      form,
      decider.name,
    );
    if (!(await this.forms.saveTransition(form, continuation, decider.correlationId))) {
      throw new AppError(BotErrors.FORM_DECIDED);
    }
    await this.stream.publish(bot.id, { type: 'form', formId: form.id, status: form.status });
    await this.stream.publish(bot.id, {
      type: 'turn',
      turnId: continuation.turn.id,
      status: 'queued',
    });
    return form.id;
  }
}
