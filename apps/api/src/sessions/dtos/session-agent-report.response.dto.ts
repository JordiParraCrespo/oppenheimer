import { ApiProperty } from '@nestjs/swagger';
import {
  SESSION_AGENT_REPORT_KINDS,
  SESSION_AGENT_REPORT_STATES,
  type SessionAgentReportKind,
  type SessionAgentReportState,
} from '@oppenheimer/shared';

/**
 * The agent's own word on what it is doing, reported through OSC 7501 (the
 * Program Status Protocol) and carried by its runner (`SessionAgentReport` in
 * `@oppenheimer/shared`). Present only when the agent said it; a state read
 * off the screen has none.
 */
export class SessionAgentReportResponseDto {
  @ApiProperty({
    enum: SESSION_AGENT_REPORT_STATES,
    description:
      'The agent’s own word. `error` is a turn that ended in an error, which `observed` reads as `done`.',
  })
  state!: SessionAgentReportState;

  @ApiProperty({
    enum: SESSION_AGENT_REPORT_KINDS,
    nullable: true,
    description: 'What a blocked agent waits on, when it said.',
  })
  kind!: SessionAgentReportKind | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    minimum: 0,
    maximum: 100,
    description: 'How far along a working or blocked agent says it is.',
  })
  progress!: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'approve Bash: pnpm test',
    description: 'What the agent says, in its own words.',
  })
  message!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'The title the agent gave its work.' })
  title!: string | null;
}
