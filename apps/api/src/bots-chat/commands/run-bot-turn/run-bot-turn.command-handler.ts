import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BotEngine } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import { BotDreamTriggerPolicy } from '../../application/bot-dream-trigger.policy';
import { BotSteeringFactory } from '../../application/bot-steering.factory';
import { BotSummaryTriggerPolicy } from '../../application/bot-summary-trigger.policy';
import { BotTurnContextResolver } from '../../application/bot-turn-context.resolver';
import { BotTurnFailureReportPolicy } from '../../application/bot-turn-failure-report.policy';
import { TurnCancelWatchFactory } from '../../application/turn-cancel-watch.factory';
import { TurnTranscript, thrownFailure } from '../../application/turn-transcript.policy';
import { TurnWriteFactory } from '../../application/turn-write.factory';
import { BOT_ENGINE, BOT_STREAM, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { RunBotTurnCommand } from './run-bot-turn.command';

/**
 * Runs one turn (`25-bots.md` §2): claims it (one running turn per bot), reads
 * what it needs, runs the engine with its steering (unless what it read says
 * the turn takes none, or has nothing left to say, and so ends at once),
 * hands what the transcript
 * writes to the turn's writer (`TurnWriteFactory`), then records how it ended,
 * makes the bot's next queued turn due and asks whether the conversation needs
 * summarizing. A turn found running was a worker that died under it, and fails
 * rather than running twice.
 * A failure that is ours to fix is reported (`BotTurnFailureReportPolicy`).
 */
@CommandHandler(RunBotTurnCommand)
export class RunBotTurnCommandHandler implements ICommandHandler<RunBotTurnCommand, void> {
  private readonly logger = new Logger(RunBotTurnCommandHandler.name);

  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    @Inject(BOT_ENGINE) private readonly engine: BotEngine,
    private readonly context: BotTurnContextResolver,
    private readonly cancelWatch: TurnCancelWatchFactory,
    private readonly summaries: BotSummaryTriggerPolicy,
    private readonly dreams: BotDreamTriggerPolicy,
    private readonly steering: BotSteeringFactory,
    private readonly writes: TurnWriteFactory,
    private readonly failures: BotTurnFailureReportPolicy,
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
    // The bot's stream is its console chat's; a channel's turn is not on it.
    if (turn.inConsole) {
      await this.stream.publish(turn.botId, { type: 'turn', turnId, status: 'running' });
    }
    return turn;
  }

  /** Runs the engine and ends the turn with how it went, a failure included. */
  private async run(turn: BotTurnEntity): Promise<void> {
    const watch = this.cancelWatch.watch(turn.id);
    let scratchDir: string | undefined;
    try {
      const shape = await this.context.resolve(turn, new Date());
      if (!shape) {
        turn.end('completed', new Date());
        return;
      }
      scratchDir = await mkdtemp(join(tmpdir(), 'bot-'));
      const transcript = new TurnTranscript(turn);
      // A message sent meanwhile that this turn cannot take waits for its own turn.
      const steering = shape.takesSteers ? this.steering.steering(turn) : undefined;
      const signal = watch.signal;
      const write = this.writes.writer(turn);
      const request = { ...shape.request, signal, scratchDir, steering };
      for await (const event of this.engine.run(request)) {
        watch.saw(event);
        for (const written of transcript.apply(event)) await write(written);
      }
      transcript.endTurn(new Date(), watch.interruption);
      this.failures.ended(turn);
    } catch (error) {
      turn.end('failed', new Date(), thrownFailure(error));
      this.failures.thrown(turn, error);
      if (!(error instanceof AppError)) {
        const stack = error instanceof Error ? error.stack : String(error);
        this.logger.error({ message: 'A bot turn failed', turnId: turn.id }, stack);
      }
    } finally {
      watch.stop();
      if (scratchDir) await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async close(turn: BotTurnEntity, correlationId: string): Promise<void> {
    // Before it reads as ended: a chat that connects after never gets a snapshot of it.
    await this.stream.forget(turn.botId, turn.id);
    if (!(await this.turns.finish(turn, correlationId))) return;
    if (turn.inConsole) {
      await this.stream.publish(turn.botId, { type: 'turn', turnId: turn.id, status: turn.status });
    }
    await this.summaries.afterTurn(turn, correlationId);
    await this.dreams.afterTurn(turn, correlationId);
  }
}
