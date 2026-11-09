import { ApiProperty } from '@nestjs/swagger';
import { TELEGRAM_ACCOUNT_STATUSES, type TelegramAccountStatus } from '@oppenheimer/shared';

/** One of the caller's connected Telegram bots, as Settings lists it. Never its token: the host keeps it. */
export class TelegramAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The host whose runner holds the token and polls.' })
  hostId!: string;

  @ApiProperty({ example: 'Shop', description: 'What the person and their bots call it.' })
  label!: string;

  @ApiProperty({
    enum: TELEGRAM_ACCOUNT_STATUSES,
    description:
      'The bot as its host last reported it: `connecting` while the host checks the token or reconnects, `connected` is polling, `revoked` and `unlinked` offer Connect again with a token.',
  })
  status!: TelegramAccountStatus;

  @ApiProperty({
    description: 'Whether the host’s runner is connected now; nothing moves while it is not.',
  })
  hostOnline!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '7012345678',
    description: 'The Telegram bot’s own user id, once its token was checked.',
  })
  botId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'shop_helper_bot',
    description: 'The Telegram bot’s `@username`, without the `@`.',
  })
  username!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The Telegram bot’s name, as @BotFather has it.',
  })
  displayName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why the bot is revoked or unlinked, in the host’s words.',
  })
  statusReason!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it was first connected.' })
  linkedAt!: string;
}
