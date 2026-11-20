import { Inject, Injectable, Logger } from '@nestjs/common';
import { BOT_MESSAGE_REPOSITORY, BOT_STREAM } from '../bots-chat.di-tokens';
import {
  type BotMessageRepositoryPort,
  TurnGoneError,
  UnstorableStepsError,
} from '../database/bot-message.repository.port';
import { sendsAsItGoes } from '../domain/bot-channel-turn.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import { BotChannelReplyResolver } from './bot-channel-reply.resolver';
import {
  failUnstoredCall,
  passedOnEvent,
  storedMessageId,
  type TranscriptWrite,
  TurnStorageError,
} from './turn-transcript.policy';

/**
 * Carries out what a running turn's transcript writes (`TurnTranscript`):
 * one case per kind of write. Text as it streams is written to the stream,
 * which keeps it until its block settles; a retry wait is passed on;
 * what is stored (a new message, a line's steps, a steer placed where the
 * turn took it) is written, then announced as that message; the words a
 * quiet turn takes back are removed, and the turn's end is what tells the
 * chat to read again. A call's end
 * whose content Postgres refuses (`UnstorableStepsError`) fails that call
 * alone (`failUnstoredCall`); a turn deleted under it (`TurnGoneError`)
 * ends it as it came; any other failed write fails the turn as `storage`
 * (`TurnStorageError`).
 *
 * A turn that sends as it goes (`sendsAsItGoes`: the owner's message on a
 * channel) also sends its chat the texts it stored once its next run of tool
 * calls begins, so "On it" reaches the person before the work, not after.
 * A send that fails is logged and never fails the turn: what it carried is
 * still in the console.
 */
@Injectable()
export class TurnWriteFactory {
  private readonly logger = new Logger(TurnWriteFactory.name);

  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly channel: BotChannelReplyResolver,
  ) {}

  /**
   * The turn's status on the bot's stream (running, or how it ended). The
   * stream is the console chat's, so a channel's turn is not announced there.
   */
  async announce(turn: BotTurnEntity): Promise<void> {
    if (!turn.inConsole) return;
    await this.stream.publish(turn.botId, { type: 'turn', turnId: turn.id, status: turn.status });
  }

  /** The writer of one running turn. */
  writer(turn: BotTurnEntity): (write: TranscriptWrite) => Promise<void> {
    if (!sendsAsItGoes(turn)) return (write) => this.apply(turn, write);
    const unsent: string[] = [];
    return async (write) => {
      await this.apply(turn, write);
      if (write.kind !== 'insert') return;
      const { role, content } = write.message;
      if (role === 'assistant' && content.trim()) unsent.push(content);
      else if (role === 'activity' && unsent.length > 0) {
        await this.sendAlong(turn, unsent.splice(0).join('\n\n'));
      }
    };
  }

  private async sendAlong(turn: BotTurnEntity, text: string): Promise<void> {
    try {
      await this.channel.send(turn, text, undefined);
    } catch (error) {
      this.logger.warn({
        message: 'Could not send a channel turn’s words as it went',
        turnId: turn.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async apply(turn: BotTurnEntity, write: TranscriptWrite): Promise<void> {
    // The bot's stream is its console chat's; a channel's turn is stored only.
    if (!turn.inConsole) {
      if (write.kind === 'text' || write.kind === 'settled' || write.kind === 'retrying') return;
      return this.stored(turn, write);
    }
    switch (write.kind) {
      case 'text':
        return this.stream.write(turn.botId, turn.id, write.block, write.text);
      case 'settled':
        return this.stream.settle(turn.botId, turn.id);
      case 'retrying':
        return this.stream.publish(turn.botId, passedOnEvent(turn.id, write));
    }
    await this.stored(turn, write);
    if (write.kind === 'unsay') return;
    const messageId = storedMessageId(write);
    await this.stream.publish(turn.botId, { type: 'message', turnId: turn.id, messageId });
  }

  private async stored(
    turn: BotTurnEntity,
    write: Extract<TranscriptWrite, { kind: 'insert' | 'steps' | 'steer' | 'unsay' }>,
  ): Promise<void> {
    try {
      await this.store(turn, write);
    } catch (error) {
      throw error instanceof TurnGoneError ? error : new TurnStorageError(error);
    }
  }

  private async store(
    turn: BotTurnEntity,
    write: Extract<TranscriptWrite, { kind: 'insert' | 'steps' | 'steer' | 'unsay' }>,
  ): Promise<void> {
    switch (write.kind) {
      case 'unsay':
        return this.messages.removeTurnWords(turn, write.messageIds);
      case 'insert':
        return this.messages.insert(write.message);
      case 'steer':
        return this.messages.placeSteer(turn, write, new Date());
      case 'steps':
        try {
          return await this.messages.saveSteps(write.message);
        } catch (error) {
          if (!(error instanceof UnstorableStepsError) || !write.callId) throw error;
          if (!failUnstoredCall(write.message, write.callId, error)) throw error;
          return this.messages.saveSteps(write.message);
        }
    }
  }
}
