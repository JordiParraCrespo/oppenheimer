import { ApiProperty } from '@nestjs/swagger';

/** A message a bot will send from the caller's Gmail at a time, still waiting (`mail.md` §3.4). */
export class ScheduledMailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'The account it goes from.' })
  accountEmail!: string;

  @ApiProperty({ type: [String], description: 'To, cc and bcc, as the card showed them.' })
  recipients!: string[];

  @ApiProperty()
  subject!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it goes.' })
  scheduledFor!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'The bot that scheduled it; null once that bot is deleted.',
  })
  botId!: string | null;
}
