import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotChannelWakeResolver } from '../../application/bot-channel-wake.resolver';
import { phoneOf } from '../../bot-whatsapp-tool.mapper';
import { whatsappContactTurn, whatsappTurnsPerHour } from '../../domain/bot-whatsapp-turn.policy';
import { WakeOnWhatsappContactCommand } from './wake-on-whatsapp-contact.command';

/**
 * A contact's message in a chat the number allows, for the bot that answers
 * it there: a contact's turn (`whatsappContactTurn`) in the chat's own
 * conversation, one per chat and bot ('0': a contact has no `/new`), keyed by
 * the stored row so a delivery twice is one turn. The resolver wakes only a
 * bot the number's owner made, and nothing past
 * `WHATSAPP_CONTACT_TURNS_PER_HOUR` turns of a person's chat, or
 * `WHATSAPP_GROUP_TURNS_PER_HOUR` of a group's, in an hour: those messages
 * are kept and wake no one.
 */
@CommandHandler(WakeOnWhatsappContactCommand)
export class WakeOnWhatsappContactCommandHandler
  implements ICommandHandler<WakeOnWhatsappContactCommand, void>
{
  constructor(private readonly channel: BotChannelWakeResolver) {}

  async execute(command: WakeOnWhatsappContactCommand): Promise<void> {
    const { organizationId, whatsappAccountId, chatId, messageRowId } = command;
    await this.channel.wake({
      chat: { kind: 'whatsapp', organizationId, botId: command.botId, whatsappAccountId, chatId },
      userId: command.userId,
      startsAt: '0',
      messageId: command.seq,
      command: 'message',
      correlationId: command.metadata.correlationId,
      turnsPerHour: whatsappTurnsPerHour(command.chatKind),
      turn: (props, conversationId) =>
        whatsappContactTurn(props, {
          conversationId,
          whatsappAccountId,
          messageRowId,
          chatKind: command.chatKind,
          chatName: command.chatName,
          senderName: command.senderName,
          sender: phoneOf(command.senderId) ?? command.senderId,
          text: command.text,
          image: command.image,
        }),
    });
  }
}
