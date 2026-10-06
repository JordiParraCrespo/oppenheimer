import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** An event as the month view draws it: wall-clock, on one day. */
export class CalendarEventResponseDto {
  @ApiProperty({
    description:
      'Ours a uuid; Google’s its own id, with the day for an all-day event spanning several.',
  })
  id!: string;

  @ApiProperty({ enum: ['personal', 'google'] })
  source!: 'personal' | 'google';

  @ApiProperty()
  title!: string;

  @ApiProperty({ description: 'Empty for Google’s events, which are read-only here.' })
  notes!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-10-07' })
  date!: string;

  @ApiProperty()
  allDay!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, example: '09:30' })
  startTime!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: '10:00' })
  endTime!: string | null;

  @ApiProperty({ description: 'Busy, or free time drawn muted.' })
  busy!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Where a Google event opens in Google Calendar; null for a personal one.',
  })
  url!: string | null;
}
