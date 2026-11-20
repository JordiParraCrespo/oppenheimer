import { ApiProperty } from '@nestjs/swagger';
import { WHATSAPP_CHAT_KINDS, type WhatsappChatKind } from '@oppenheimer/shared';
import { WhatsappChatGrantResponseDto } from './whatsapp-chat-grant.response.dto';

/** One chat a linked number has seen, or allows, and who answers it there. */
export class WhatsappChatRouteResponseDto {
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

  @ApiProperty({ description: 'How many of its messages the number keeps.' })
  messageCount!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the number last saw a message in it; null for a chat allowed before any.',
  })
  lastAt!: string | null;

  @ApiProperty({
    type: WhatsappChatGrantResponseDto,
    nullable: true,
    description:
      'Its grant: the chat is answered, by `botId` (null: the number’s default bot). Null when no one answers it.',
  })
  grant!: WhatsappChatGrantResponseDto | null;
}
