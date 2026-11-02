import { ApiProperty } from '@nestjs/swagger';
import { INBOX_MARKS, type InboxMark } from '@oppenheimer/shared';

/** What the person did to one occurrence of an Inbox item. */
export class InboxMarkResponseDto {
  @ApiProperty({
    description:
      'The occurrence: `session:<id>:<observedSince>`, `approval:<id>`, `pull:<repoId>#<number>@<sha>` or `run:<id>`.',
  })
  itemKey!: string;

  @ApiProperty({ enum: INBOX_MARKS })
  mark!: InboxMark;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'When a snooze ends; null for every other mark.',
  })
  until!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'When the mark was last set.' })
  updatedAt!: string;
}
