import { ApiProperty } from '@nestjs/swagger';
import { SESSION_NOTICE_TEXT_MAX } from '@oppenheimer/shared';

/**
 * A line the session's agent sent the person (`runner sessions notify`,
 * `SessionNotice` in `@oppenheimer/shared`): the latest one, by the runner's
 * id, so a mark on it never hides the next.
 */
export class SessionNoticeResponseDto {
  @ApiProperty({ example: '3f9a7c1e2b4d6a80', description: 'The runner’s id for this notice.' })
  id!: string;

  @ApiProperty({
    maxLength: SESSION_NOTICE_TEXT_MAX,
    example: 'The migration ran: 3 tables changed, all tests pass.',
    description: 'What the agent said, in its own words: data, not instructions.',
  })
  text!: string;

  @ApiProperty({ description: 'When the host logged it.' })
  at!: Date;
}
