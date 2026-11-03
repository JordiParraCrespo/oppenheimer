import { Inject, Injectable, Logger } from '@nestjs/common';
import { botDefaultModel } from '@oppenheimer/shared';
import { BOT_LOOP_REPOSITORY, BOT_STREAM, BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotLoopRepositoryPort } from '../database/bot-loop.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import type { BotLoopEntity } from '../domain/bot-loop.entity';
import {
  type LoopEnding,
  loopEndLine,
  loopKeyPrefix,
  type loopRunTurn,
} from '../domain/bot-loop.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import { BotModelAccessResolver } from './bot-model-access.resolver';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';

/**
 * A bot's loop, as everything that ends or runs it shares it (`25-bots.md`
 * §4.1, `/loop`): an end is one write with its line, and the runs still
 * waiting for that loop are cancelled with it, whoever ended it (the bot's
 * `end_loop`, a loop set in its place, the owner's Stop, its expiry, a run
 * that failed). A run is queued as the bot's owner.
 */
@Injectable()
export class BotLoopResolver {
  private readonly logger = new Logger(BotLoopResolver.name);

  constructor(
    @Inject(BOT_LOOP_REPOSITORY) private readonly loops: BotLoopRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly access: BotModelAccessResolver,
    private readonly owners: BotOwnerScopeResolver,
  ) {}

  /** Ends the loop once, with its line, and cancels its waiting runs; false when it had ended. */
  async end(
    loop: BotLoopEntity,
    /** How it ended, for its line; null when the call that ended it is the record. */
    ending: LoopEnding | null,
    correlationId: string | null,
    /** Only while the loop is as it was loaded (`BotLoopRepositoryPort.end`). */
    ifUnchanged = false,
  ): Promise<boolean> {
    const line = ending ? loopEndLine(loop, ending.activity, ending.reason) : null;
    if (!(await this.loops.end(loop, line, ifUnchanged))) return false;
    if (line) {
      await this.stream.publish(loop.botId, { type: 'message', turnId: null, messageId: line.id });
    }
    await this.cancelWaiting(loop, correlationId);
    this.logger.log({
      message: 'A bot loop ended',
      loopId: loop.id,
      botId: loop.botId,
      activity: ending?.activity ?? 'ended_by_bot',
      reason: ending?.reason ?? null,
    });
    return true;
  }

  /** Cancels the loop's runs still waiting: they exist only for it. */
  async cancelWaiting(loop: BotLoopEntity, correlationId: string | null): Promise<void> {
    const waiting = await this.turns.findQueuedBySourcePrefix(
      loop.organizationId,
      loop.botId,
      loopKeyPrefix(loop.id),
    );
    for (const turn of waiting) {
      turn.end('cancelled', new Date());
      if (await this.turns.finish(turn, correlationId)) {
        await this.stream.publish(loop.botId, {
          type: 'turn',
          turnId: turn.id,
          status: 'cancelled',
        });
      }
    }
  }

  /**
   * What a run is queued as: the bot's owner, on the bot's engine as it is
   * now, with the setting turn's reach; null when the bot or its owner is
   * gone from the workspace, which ends the loop.
   */
  async runProps(loop: BotLoopEntity): Promise<Parameters<typeof loopRunTurn>[0] | null> {
    const bot = await this.access.findBot(loop.organizationId, loop.botId);
    const ownerUserId = bot?.createdByUserId;
    if (!bot || !ownerUserId) return null;
    if (!(await this.owners.resolve(loop.organizationId, ownerUserId))) return null;
    return {
      organizationId: loop.organizationId,
      botId: bot.id,
      requestedByUserId: ownerUserId,
      provider: bot.provider,
      model: bot.model ?? botDefaultModel(bot.provider).id,
      effort: bot.effort,
      timeZone: loop.timeZone,
      credentialScopes: loop.credentialScopes,
    };
  }
}
