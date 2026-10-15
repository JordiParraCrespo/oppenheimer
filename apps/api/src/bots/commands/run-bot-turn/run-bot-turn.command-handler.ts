import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { BotEngine } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import { BotTurnContextResolver } from '../../application/bot-turn-context.resolver';
import { type TranscriptWrite, TurnTranscript } from '../../application/turn-transcript.policy';
import {
  BOT_ENGINE,
  BOT_MESSAGE_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
} from '../../bots.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { RunBotTurnCommand } from './run-bot-turn.command';

/** How often a running turn looks for Stop. */
const CANCEL_POLL_MS = 750;

/**
 * Runs one turn (`25-bots.md` §2): claims it (one running turn per bot), reads
 * what it needs, runs the engine, stores the chat's messages as they finish
 * and streams the text as it is written, then records how it ended and makes
 * the bot's next queued turn due. A turn found running was a worker that died
 * under it, and fails rather than running twice.
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
  ) {}

  async execute({ turnId, metadata }: RunBotTurnCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return;
    const turn = found.unwrap();
    if (turn.status === 'running') {
      turn.end('failed', new Date(), {
        error: 'The turn was interrupted. Send the message again.',
      });
      return this.close(turn, metadata.correlationId);
    }
    if (turn.status !== 'queued') return;
    turn.start(new Date());
    // Busy: another turn of the bot runs, and stages this one when it ends.
    if ((await this.turns.claim(turn)) !== 'claimed') return;
    await this.stream.publish(turn.botId, { type: 'turn', turnId, status: 'running' });

    const prompt = (await this.messages.findPrompt(turn.organizationId, turn.id)) ?? '';
    const abort = new AbortController();
    const watch = setInterval(() => {
      void this.turns.isCancelRequested(turn.id).then((asked) => asked && abort.abort());
    }, CANCEL_POLL_MS);
    watch.unref();
    const scratchDir = await mkdtemp(join(tmpdir(), 'oppenheimer-bot-turn-'));
    const transcript = new TurnTranscript(turn);
    try {
      const context = await this.context.resolve(turn, prompt, new Date());
      for await (const event of this.engine.run({ ...context, signal: abort.signal, scratchDir })) {
        for (const write of transcript.apply(event)) await this.apply(turn, write);
      }
      const { reason, error, inputTokens, outputTokens } = transcript.result;
      const status = reason === 'completed' || reason === 'max_steps' ? 'completed' : reason;
      turn.end(status, new Date(), { error, inputTokens, outputTokens });
    } catch (error) {
      turn.end('failed', new Date(), { error: reasonOf(error) });
      if (!(error instanceof AppError)) {
        this.logger.error(
          { message: 'A bot turn failed', turnId },
          error instanceof Error ? error.stack : String(error),
        );
      }
    } finally {
      clearInterval(watch);
      await rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
    await this.close(turn, metadata.correlationId);
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
    if (await this.turns.finish(turn, correlationId)) {
      await this.stream.publish(turn.botId, {
        type: 'turn',
        turnId: turn.id,
        status: turn.status,
      });
    }
  }
}

/** A failure in words a person can act on: the catalog's for ours, the engine's otherwise. */
function reasonOf(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return error instanceof Error ? error.message.slice(0, 500) : 'The turn failed';
}
