import { ApiProperty } from '@nestjs/swagger';
import { BotApprovalResponseDto } from './bot-approval.response.dto';

/** An approval read across the workspace's bots: the card, and whose it is. */
export class WorkspaceBotApprovalResponseDto extends BotApprovalResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The bot that asked.' })
  botId!: string;

  @ApiProperty({ description: "The bot's name, as the console shows it." })
  botName!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description:
      'The session the call started when it ran on a yes; null before, and when it started none.',
  })
  sessionId!: string | null;
}
