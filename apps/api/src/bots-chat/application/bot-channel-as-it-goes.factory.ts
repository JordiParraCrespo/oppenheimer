import { Injectable, Logger } from '@nestjs/common';
import { SaidAsItGoes, sendsAsItGoes } from '../domain/bot-channel-turn.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotChannelReplyResolver } from './bot-channel-reply.resolver';
import type { TranscriptWrite } from './turn-transcript.policy';

/**
 * A running turn's writer, for a turn that sends as it goes
 * (`sendsAsItGoes`: the owner's message on a channel): each write is stored
 * as ever, then what the bot wrote before a run of tool calls goes to the
 * chat as that run begins (`SaidAsItGoes`), so "On it" reaches the person
 * before the work, not after it. Any other turn's writer is handed back as
 * it is. A send that does not go leaves its words owed for the next one, and
 * never fails the turn: they are still in the console. Wrapping a turn's
 * writer is its run starting, so the chat is shown it is being worked on
 * then (`BotChannelReplyResolver.started`), before the turn goes on.
 */
@Injectable()
export class BotChannelAsItGoesFactory {
  private readonly logger = new Logger(BotChannelAsItGoesFactory.name);

  constructor(private readonly channel: BotChannelReplyResolver) {}

  async wrap(
    turn: BotTurnEntity,
    write: (write: TranscriptWrite) => Promise<void>,
  ): Promise<(write: TranscriptWrite) => Promise<void>> {
    if (!sendsAsItGoes(turn)) return write;
    // Awaited, so the end's removal (`DeliverChannelReplyCommandHandler`) always comes after it.
    await this.channel.started(turn).catch((error: unknown) =>
      this.logger.warn({
        message: 'Could not show a channel turn as being worked on',
        turnId: turn.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    const said = new SaidAsItGoes();
    return async (each) => {
      await write(each);
      if (each.kind !== 'insert') return;
      const text = said.stored(each.message);
      if (text && (await this.send(turn, text))) said.sent();
    };
  }

  private async send(turn: BotTurnEntity, text: string): Promise<boolean> {
    try {
      return (await this.channel.send(turn, text, undefined)) > 0;
    } catch (error) {
      this.logger.warn({
        message: 'Could not send a channel turn’s words as it went',
        turnId: turn.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
