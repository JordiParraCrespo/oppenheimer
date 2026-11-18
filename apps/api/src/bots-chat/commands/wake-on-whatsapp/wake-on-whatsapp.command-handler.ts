import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { TranscribeWhatsappVoiceNoteCommand } from '../../../whatsapp/commands/transcribe-whatsapp-voice-note/transcribe-whatsapp-voice-note.command';
import { BotChannelWakeResolver } from '../../application/bot-channel-wake.resolver';
import { whatsappTurn } from '../../domain/bot-whatsapp-turn.policy';
import { WakeOnWhatsappCommand } from './wake-on-whatsapp.command';

/**
 * The owner's message to their linked number, for the Oppenheimer bot that
 * answers the chat there: a turn in
 * the chat's conversation that holds the message, the one starting at the
 * later of the owner's last `/new` and last switch by name before it (fixed
 * when the message was stored, by `whatsapp_message.seq`, so deliveries in
 * any order agree), keyed by the stored row so a delivery twice is one turn;
 * `/new` starts a conversation at itself; `/stop` asks the conversation's
 * running turn to stop (`BotChannelWakeResolver`). The resolver wakes
 * only a bot the owner made, so a switch by name never reaches someone
 * else's bot. A voice note is heard first, and the turn's words are what it
 * says (or why it could not be heard), so the bot answers it as it would text.
 */
@CommandHandler(WakeOnWhatsappCommand)
export class WakeOnWhatsappCommandHandler implements ICommandHandler<WakeOnWhatsappCommand, void> {
  constructor(
    private readonly channel: BotChannelWakeResolver,
    private readonly commands: CommandBus,
  ) {}

  async execute(command: WakeOnWhatsappCommand): Promise<void> {
    const { organizationId, whatsappAccountId, chatId, messageRowId } = command;
    const text =
      command.command === 'message' && command.voiceNote
        ? await this.commands.execute<TranscribeWhatsappVoiceNoteCommand, string>(
            new TranscribeWhatsappVoiceNoteCommand({
              organizationId,
              accountId: whatsappAccountId,
              messageRowId,
              metadata: { correlationId: command.metadata.correlationId ?? undefined },
            }),
          )
        : command.text;
    await this.channel.wake({
      chat: { kind: 'whatsapp', organizationId, botId: command.botId, whatsappAccountId, chatId },
      userId: command.userId,
      startsAt: command.conversationStartsAt,
      messageId: command.seq,
      command: command.command,
      correlationId: command.metadata.correlationId,
      turn: (props, conversationId) =>
        whatsappTurn(props, {
          conversationId,
          whatsappAccountId,
          messageRowId,
          text,
        }),
    });
  }
}
