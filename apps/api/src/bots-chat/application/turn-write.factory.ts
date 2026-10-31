import { Inject, Injectable } from '@nestjs/common';
import { BOT_MESSAGE_REPOSITORY, BOT_STREAM } from '../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import { passedOnEvent, storedMessageId, type TranscriptWrite } from './turn-transcript.policy';

/**
 * Carries out what a running turn's transcript writes (`TurnTranscript`):
 * one case per kind of write. What is only passed on goes to the stream;
 * what is stored (a new message, a line's steps, a steer placed where the
 * turn took it) is written, then announced as that message.
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
      case 'retrying':
        return this.stream.publish(turn.botId, passedOnEvent(turn.id, write));
      case 'insert':
        await this.messages.insert(write.message);
        break;
      case 'steps':
        await this.messages.saveSteps(write.message);
        break;
      case 'steer':
        await this.messages.placeSteer(turn, write, new Date());
        break;
    }
    const messageId = storedMessageId(write);
    await this.stream.publish(turn.botId, { type: 'message', turnId: turn.id, messageId });
  }
}
