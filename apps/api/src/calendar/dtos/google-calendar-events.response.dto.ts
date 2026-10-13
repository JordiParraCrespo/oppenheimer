import { ApiProperty } from '@nestjs/swagger';
import { CalendarEventResponseDto } from './calendar-event.response.dto';

/** A Google event, and the account it was read from. */
export class GoogleCalendarEventResponseDto extends CalendarEventResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The connection it was read from; the first one read when two accounts share it.',
  })
  connectionId!: string;
}

/** How one account's read went. */
export class GoogleCalendarAccountReadResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The connection.' })
  id!: string;

  @ApiProperty({
    enum: ['ok', 'revoked', 'error'],
    description:
      '`revoked`: Google dropped the grant, reconnect it. `error`: Google did not answer for it this time.',
  })
  status!: 'ok' | 'revoked' | 'error';
}

/** Every connected account's events for the range, each meeting once. */
export class GoogleCalendarEventsResponseDto {
  @ApiProperty({ type: [GoogleCalendarEventResponseDto] })
  events!: GoogleCalendarEventResponseDto[];

  @ApiProperty({
    type: [GoogleCalendarAccountReadResponseDto],
    description: 'One per connection: one account failing marks only itself.',
  })
  accounts!: GoogleCalendarAccountReadResponseDto[];
}
