import { ApiProperty } from '@nestjs/swagger';

/** A one-time `start` link that records whoever opens it in Telegram as the bot's owner. */
export class TelegramOwnerLinkResponseDto {
  @ApiProperty({
    format: 'uri',
    example: 'https://t.me/shop_helper_bot?start=Q2xhdWRlIHdhcyBoZXJl',
    description: 'Opens the bot in Telegram and sends it `/start` with the one-time code.',
  })
  url!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When the link stops working: ten minutes after it was made.',
  })
  expiresAt!: string;
}
