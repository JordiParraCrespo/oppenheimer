import { ApiProperty } from '@nestjs/swagger';

/** The workspace's Sentry connection. The client secret is never returned, only its last four characters. */
export class SentryConnectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'The Sentry organization slug', example: 'acme' })
  organizationSlug!: string;

  @ApiProperty({ description: 'The client secret’s last four characters', example: '9f3a' })
  secretHint!: string;

  @ApiProperty({
    description:
      'Where the internal integration sends its webhooks: paste it into Sentry as the Webhook URL',
    example: 'https://console.example.com/api/v1/sentry/webhooks/6f1c…',
  })
  webhookUrl!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** Whether this server can connect Sentry at all, and the workspace's connection if it has one. */
export class SentryStatusResponseDto {
  @ApiProperty({
    description:
      'Whether this server can keep a client secret (`SENTRY_CONNECTION_KEY`). False: connecting answers SENTRY_001.',
  })
  configured!: boolean;

  @ApiProperty({ type: SentryConnectionResponseDto, nullable: true })
  connection!: SentryConnectionResponseDto | null;
}
