import { Inject, Injectable } from '@nestjs/common';
import { BOT_MESSAGE_REPOSITORY, BOT_STREAM } from '../bots-chat.di-tokens';
import {
  type BotMessageRepositoryPort,
  UnstorableStepsError,
} from '../database/bot-message.repository.port';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
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
 * turn took it) is written, then announced as that message. A call's end
 * whose content Postgres refuses (`UnstorableStepsError`) fails that call
 * alone (`failUnstoredCall`); any other failed write fails the turn as
 * `storage` (`TurnStorageError`).
 */
@Injectable()
export class TurnWriteFactory {
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  /** The writer of one running turn. */
  writer(turn: BotTurnEntity): (write: TranscriptWrite) => Promise<void> {
    return (write) => this.apply(turn, write);
  }

  private async apply(turn: BotTurnEntity, write: TranscriptWrite): Promise<void> {
    switch (write.kind) {
      case 'text':
        return this.stream.write(turn.botId, turn.id, write.block, write.text);
      case 'settled':
        return this.stream.settle(turn.botId, turn.id);
      case 'retrying':
        return this.stream.publish(turn.botId, passedOnEvent(turn.id, write));
    }
    try {
      await this.store(turn, write);
    } catch (error) {
      throw new TurnStorageError(error);
    }
    const messageId = storedMessageId(write);
    await this.stream.publish(turn.botId, { type: 'message', turnId: turn.id, messageId });
  }

  private async store(
    turn: BotTurnEntity,
    write: Extract<TranscriptWrite, { kind: 'insert' | 'steps' | 'steer' }>,
  ): Promise<void> {
    switch (write.kind) {
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
