import { ApiProperty } from '@nestjs/swagger';
import { GOOGLE_CALENDAR_ACCOUNTS_MAX } from '@oppenheimer/shared';

/** One of the caller's Google accounts, as the sidebar lists it. Never the token. */
export class GoogleCalendarConnectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ana@example.com' })
  accountEmail!: string;

  @ApiProperty({
    enum: ['active', 'revoked'],
    description: '`revoked` when Google dropped the grant: the account offers Reconnect.',
  })
  status!: 'active' | 'revoked';

  @ApiProperty({
    minimum: 0,
    maximum: GOOGLE_CALENDAR_ACCOUNTS_MAX - 1,
    description:
      'The account’s colour on the month: the lowest free one when it was connected, never reassigned.',
  })
  colorIndex!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it was first connected.' })
  connectedAt!: string;
}

/** Where Connect Google Calendar sends the browser. */
export class GoogleCalendarConnectStartResponseDto {
  @ApiProperty({ description: 'Google’s consent page, carrying the single-use state.' })
  url!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;
}
