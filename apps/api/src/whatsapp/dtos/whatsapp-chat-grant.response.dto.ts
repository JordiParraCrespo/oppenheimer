import { ApiProperty } from '@nestjs/swagger';
import { WHATSAPP_CHAT_KINDS, type WhatsappChatKind } from '@oppenheimer/shared';

/** A chat a linked number allows besides its owner's, and the bot that answers there. */
export class WhatsappChatGrantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The linked number the chat is on.' })
  accountId!: string;

  @ApiProperty({
    example: '120363000000000000@g.us',
    description: 'The chat’s WhatsApp id: a group’s, or a person’s number.',
  })
  chatId!: string;

  @ApiProperty({ enum: WHATSAPP_CHAT_KINDS })
  chatKind!: WhatsappChatKind;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The group’s or person’s name as the number last saw it.',
  })
  chatName!: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The bot that answers in this chat; null for the number’s default bot.',
  })
  botId!: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The bot whose tool allowed the chat, in the owner’s own chat with it; null when allowed in Settings.',
  })
  grantedByBotId!: string | null;

  @ApiProperty({ format: 'date-time' })
  grantedAt!: string;
}
