import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The caller's own Google Calendar connection, as the sidebar card shows it. */
export class GoogleCalendarConnectionResponseDto {
  @ApiProperty({ description: 'Whether the caller has connected, revoked or not.' })
  connected!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'ana@example.com' })
  accountEmail!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['active', 'revoked'],
    description: '`revoked` when Google dropped the grant: the card offers Reconnect.',
  })
  status!: 'active' | 'revoked' | null;
}

/** Where Connect Google Calendar sends the browser. */
export class GoogleCalendarConnectStartResponseDto {
  @ApiProperty({ description: 'Google’s consent page, carrying the single-use state.' })
  url!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;
}
