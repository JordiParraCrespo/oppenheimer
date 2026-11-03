import { ApiProperty } from '@nestjs/swagger';
import { BOT_NOTICE_TEXT_MAX, type WorkspaceBotNotice } from '@oppenheimer/shared';

/** A bot's latest notice, read across the workspace's bots (the Inbox). */
export class WorkspaceBotNoticeResponseDto implements WorkspaceBotNotice {
  @ApiProperty({
    format: 'uuid',
    description: 'The notice: a new id with each notice, so a mark on one never hides the next.',
  })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The bot that sent it.' })
  botId!: string;

  @ApiProperty({ description: "The bot's name, as the console shows it." })
  botName!: string;

  @ApiProperty({ maxLength: BOT_NOTICE_TEXT_MAX, description: 'The line, as the bot wrote it.' })
  text!: string;

  @ApiProperty({ format: 'date-time', description: 'When it came.' })
  at!: string;
}
