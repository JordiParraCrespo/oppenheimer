import { ApiProperty } from '@nestjs/swagger';
import { SLACK_ACCOUNT_STATUSES, type SlackAccountStatus } from '@oppenheimer/shared';

/** A bot's connected Slack app, as its settings show it. Never its token or signing secret. */
export class SlackAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The Oppenheimer bot the app is.' })
  botId!: string;

  @ApiProperty({
    enum: SLACK_ACCOUNT_STATUSES,
    description:
      '`connected` answers; `revoked` is a token Slack refused (the app was uninstalled, or the token rotated), until it is connected again.',
  })
  status!: SlackAccountStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why it is revoked, in Slack’s words.',
  })
  statusReason!: string | null;

  @ApiProperty({
    example: 'T0123ABCD',
    description: 'The Slack workspace the app is installed in.',
  })
  teamId!: string;

  @ApiProperty({ example: 'Acme' })
  teamName!: string;

  @ApiProperty({ example: 'U0123ABCD', description: 'The app’s bot user.' })
  botUserId!: string;

  @ApiProperty({ example: 'juno' })
  botName!: string;

  @ApiProperty({ example: 'x9Qa', description: 'The bot token’s last characters.' })
  tokenHint!: string;

  @ApiProperty({
    description: 'Whether the owner’s Slack user is recorded, by the one-time `link` code.',
  })
  ownerLinked!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it was first connected.' })
  linkedAt!: string;
}
