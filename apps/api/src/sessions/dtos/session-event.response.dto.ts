import { ApiProperty } from '@nestjs/swagger';

/**
 * One entry of a session's append-only log.
 *
 * `seq` is the control plane's, assigned under a row lock, which is what makes the
 * log dense and a cursor over it stable. `occurredAt` is the writer's clock and
 * `recordedAt` is ours, so a host with a skewed clock cannot reorder history.
 */
export class SessionEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({
    description:
      'Dense and monotonic per session. Assigned by the control plane, never on the wire.',
    example: 4,
  })
  seq!: number;

  @ApiProperty({ enum: ['runner', 'api'], description: 'Who wrote the entry.' })
  source!: 'runner' | 'api';

  @ApiProperty({
    description:
      'What happened. Free-form on purpose: a runner newer than this control plane may log a kind it has never heard of, and the log keeps it.',
    example: 'session.started',
  })
  kind!: string;

  @ApiProperty({
    description:
      'At most 8 KB, and never pane text: PTY bytes go to the browser and the runner’s ring buffer, never to Postgres.',
    type: Object,
  })
  payload!: unknown;

  @ApiProperty({ description: 'The writer’s clock.' })
  occurredAt!: Date;

  @ApiProperty({ description: 'Ours.' })
  recordedAt!: Date;
}

/** A page of the log, as a cursor rather than a page number. */
export class SessionEventPageResponseDto {
  @ApiProperty({ type: [SessionEventResponseDto] })
  data!: SessionEventResponseDto[];

  @ApiProperty({
    description: 'Pass as `afterSeq` to read on, or null at the end of the log.',
    nullable: true,
    type: Number,
    example: 24,
  })
  nextSeq!: number | null;
}
