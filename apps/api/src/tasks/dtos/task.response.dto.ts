import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TASK_STATUSES, type TaskStatus } from '@oppenheimer/shared';

/** A session on a task. The console reads the session itself from its own list. */
export class TaskSessionLinkResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({
    enum: ['started', 'linked'],
    description: '`started` from this task, or `linked` to it afterwards.',
  })
  origin!: 'started' | 'linked';

  @ApiProperty({ type: String, format: 'date-time' })
  linkedAt!: string;
}

export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Always set: a task with no project is filed under the Unassigned one.',
  })
  projectId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  goalId!: string | null;

  @ApiProperty({ enum: TASK_STATUSES })
  status!: TaskStatus;

  @ApiProperty({
    description:
      'Its place in the column. Compare byte by byte (not with a locale): the board is ordered by it.',
    example: 'V',
  })
  rank!: string;

  @ApiProperty({ example: 'Biometric unlock on Android' })
  title!: string;

  @ApiProperty({ description: 'Free text; empty when there are none.' })
  notes!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date',
    description: 'A calendar day, read in the viewer’s timezone.',
    example: '2026-10-07',
  })
  dueDate!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: '09:00' })
  dueTime!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  completedAt!: string | null;

  @ApiProperty({ type: [TaskSessionLinkResponseDto], description: 'Oldest first.' })
  sessions!: TaskSessionLinkResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

/** What starting a session from a task answers: the task as it now is, and the session. */
export class StartTaskSessionResponseDto {
  @ApiProperty({ type: TaskResponseDto })
  task!: TaskResponseDto;

  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({
    type: [String],
    description:
      'What the control plane could not do just now: `host_offline` when the session waits for its host.',
  })
  hints!: string[];
}
