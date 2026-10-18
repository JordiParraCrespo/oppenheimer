import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { botDefaultModel } from '@oppenheimer/shared';
import type {
  AutomationRunTargetPort,
  RunTargetContext,
  RunTargetDecision,
} from '../../automations/application/automation-run-target.port';
import type { RunDispatchRef } from '../../automations/domain/automation.types';
import { composeRunPrompt } from '../../automations/domain/run-launch.policy';
import type { RunRefusal } from '../../automations/domain/run-refusal.policy';
import { BotErrors } from '../../bots/domain/bots.errors';
import { BotModelAccessResolver } from '../application/bot-model-access.resolver';
import { BOT_STREAM, BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import { routinePrefix, routineTurn } from '../domain/bot-routine.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import type { BotStreamPort } from './bot-stream.port';

/** The turn a routine's run queues, built at the decision and stored at the launch. */
interface RoutineLaunch {
  turn: BotTurnEntity;
  opening: BotMessageEntity;
}

/** Refusals that mean the routine cannot run now: the bot is gone, or its provider has no credential. */
const REFUSALS: Readonly<Record<string, RunRefusal>> = {
  [BotErrors.NOT_FOUND.code]: { reason: 'not_launchable', pause: null },
  [BotErrors.PROVIDER_KEY_MISSING.code]: { reason: 'not_launchable', pause: null },
};

/**
 * A bot routine's run (`26-bot-routines.md` §4): one more queued turn of the
 * bot, on its provider, model and effort as they are now, as the routine's
 * owner and within the scopes of the credential that saved it. The turn
 * queue is what holds a busy bot and survives a restart, and the turn's
 * source key makes a run dispatched twice queue it once.
 */
@Injectable()
export class BotRoutineTarget implements AutomationRunTargetPort<RoutineLaunch> {
  readonly kind = 'bot' as const;

  constructor(
    private readonly access: BotModelAccessResolver,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  async decide(context: RunTargetContext): Promise<RunTargetDecision<RoutineLaunch>> {
    const { automation, run, event, limits, now } = context;
    const botId = automation.botId;
    if (!botId) throw new Error(`Automation ${automation.id} runs on a bot but names none`);

    const model = await this.access.ownModel(automation.organizationId, botId, now);
    if (!model) return { kind: 'skip', reason: 'not_launchable', pause: null };

    // A routine whose last turn still waits or runs: note 16's overlap guard,
    // read from the bot's queue instead of a host.
    if (
      limits.overlap === 'skip' &&
      (await this.turns.hasActiveFrom(
        automation.organizationId,
        botId,
        routinePrefix(automation.id),
      ))
    ) {
      return { kind: 'skip', reason: 'overlapping', pause: null };
    }

    const instructions = composeRunPrompt(automation.revision.prompt, event);
    if (instructions === null) return { kind: 'skip', reason: 'not_launchable', pause: null };

    const bot = await this.access.bot(automation.organizationId, botId);
    const trigger = automation.triggers.find((candidate) => candidate.id === run.triggerId);
    return {
      kind: 'launch',
      input: routineTurn(
        {
          organizationId: automation.organizationId,
          botId,
          requestedByUserId: automation.ownerUserId,
          provider: bot.provider,
          model: bot.model ?? botDefaultModel(bot.provider).id,
          effort: bot.effort,
          // A schedule's times are in its zone; anything else, in UTC.
          timeZone: trigger?.timezone ?? null,
          credentialScopes: automation.credentialScopes,
        },
        { automationId: automation.id, runId: run.id, name: automation.name, instructions },
      ),
    };
  }

  async launch(_context: RunTargetContext, input: RoutineLaunch): Promise<RunDispatchRef> {
    const { turn, opening } = input;
    const { outcome, turnId } = await this.turns.enqueueOnce(turn, opening, null);
    if (outcome === 'missing') throw new AppError(BotErrors.NOT_FOUND);
    if (outcome !== 'existing') {
      await this.stream.publish(turn.botId, { type: 'turn', turnId, status: 'queued' });
    }
    return { kind: 'bot_turn', turnId };
  }

  refusalOf(error: unknown): RunRefusal | null {
    return error instanceof AppError ? (REFUSALS[error.code] ?? null) : null;
  }
}
