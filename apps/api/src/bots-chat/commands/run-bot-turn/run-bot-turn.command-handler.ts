import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BotEngine } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import { BotSummaryTriggerPolicy } from '../../application/bot-summary-trigger.policy';
import { BotTurnContextResolver } from '../../application/bot-turn-context.resolver';
import { TurnCancelWatchFactory } from '../../application/turn-cancel-watch.factory';
import {
  failureKindOf,
  failureReasonOf,
  type TranscriptWrite,
  TurnTranscript,
} from '../../application/turn-transcript.policy';
import {
  BOT_ENGINE,
  BOT_MESSAGE_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { RunBotTurnCommand } from './run-bot-turn.command';

/**
 * Runs one turn (`25-bots.md` §2): claims it (one running turn per bot), reads
 * what it needs, runs the engine, stores and streams what it writes, then
 * records how it ended, makes the bot's next queued turn due and asks whether
 * the conversation needs summarizing. A turn found running was a worker that
 * died under it, and fails rather than running twice.
 */
@CommandHandler(RunBotTurnCommand)
export class RunBotTurnCommandHandler implements ICommandHandler<RunBotTurnCommand, void> {
  private readonly logger = new Logger(RunBotTurnCommandHandler.name);

  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    @Inject(BOT_ENGINE) private readonly engine: BotEngine,
    private readonly context: BotTurnContextResolver,
    private readonly cancelWatch: TurnCancelWatchFactory,
    private readonly summaries: BotSummaryTriggerPolicy,
  ) {}

  async execute({ turnId, metadata }: RunBotTurnCommand): Promise<void> {
    const turn = await this.claim(turnId, metadata.correlationId);
    if (!turn) return;
    await this.run(turn);
    await this.close(turn, metadata.correlationId);
  }

  /** The turn, now running on this worker; null when there is nothing to run. */
  private async claim(turnId: string, correlationId: string): Promise<BotTurnEntity | null> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return null;
    const turn = found.unwrap();
    if (turn.status === 'running') {
      turn.abandon(new Date());
      await this.close(turn, correlationId);
      return null;
    }
    if (turn.status !== 'queued') return null;
    turn.start(new Date());
    // Busy: another turn of the bot runs, and stages this one when it ends.
    if ((await this.turns.claim(turn)) !== 'claimed') return null;
    await this.stream.publish(turn.botId, { type: 'turn', turnId, status: 'running' });
    return turn;
  }

  /** Runs the engine and ends the turn with how it went, a failure included. */
  private async run(turn: BotTurnEntity): Promise<void> {
    const watch = this.cancelWatch.watch(turn.id);
    let scratchDir: string | undefined;
    try {
      scratchDir = await mkdtemp(join(tmpdir(), 'bot-'));
      const context = await this.context.resolve(turn, new Date());
      const transcript = new TurnTranscript(turn);
      for await (const event of this.engine.run({ ...context, signal: watch.signal, scratchDir })) {
        for (const write of transcript.apply(event)) await this.apply(turn, write);
      }
      transcript.endTurn(new Date(), watch.interruption);
    } catch (error) {
      turn.end('failed', new Date(), {
        error: failureReasonOf(error),
        failure: failureKindOf(error),
      });
      if (!(error instanceof AppError)) {
        const stack = error instanceof Error ? error.stack : String(error);
        this.logger.error({ message: 'A bot turn failed', turnId: turn.id }, stack);
      }
    } finally {
      watch.stop();
      if (scratchDir) await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async apply(turn: BotTurnEntity, write: TranscriptWrite): Promise<void> {
    if (write.kind === 'text') {
      await this.stream.publish(turn.botId, { type: 'text', turnId: turn.id, text: write.text });
      return;
    }
    if (write.kind === 'insert') await this.messages.insert(write.message);
    else await this.messages.saveSteps(write.message);
    await this.stream.publish(turn.botId, {
      type: 'message',
      turnId: turn.id,
      messageId: write.message.id,
    });
  }

  private async close(turn: BotTurnEntity, correlationId: string): Promise<void> {
    if (!(await this.turns.finish(turn, correlationId))) return;
    await this.stream.publish(turn.botId, { type: 'turn', turnId: turn.id, status: turn.status });
    await this.summaries.afterTurn(turn, correlationId);
  }
}
