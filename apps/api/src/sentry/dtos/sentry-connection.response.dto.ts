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
