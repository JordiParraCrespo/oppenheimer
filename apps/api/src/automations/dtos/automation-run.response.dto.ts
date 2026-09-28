import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { nullableEnum } from '@oppenheimer/backend-core';
import {
  AUTOMATION_RUN_CAUSES,
  AUTOMATION_RUN_OUTCOMES,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_SKIP_REASONS,
  type AutomationRunCause,
  type AutomationRunOutcome,
  type AutomationRunStatus,
  type AutomationSkipReason,
} from '@oppenheimer/shared/automations';

export class RunCauseResponseDto {
  @ApiProperty({ example: 'Pull request opened' })
  label!: string;

  @ApiProperty({ example: 'Harden API config loading' })
  text!: string;

  @ApiPropertyOptional({ example: 'acme/xrp-mobile#124' })
  ref?: string;

  @ApiPropertyOptional({ example: 'jordiparra' })
  actor?: string;

  @ApiPropertyOptional()
  url?: string;

  @ApiProperty({ description: 'The catalog event, or `schedule` / `manual`.' })
  eventType!: string;
}

export class RunTurnResponseDto {
  @ApiProperty({
    enum: [
      'queued',
      'in_progress',
      'requires_action',
      'completed',
      'failed',
      'cancelled',
      'expired',
    ],
  })
  state!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  exitCode!: number | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'The agent’s final message.' })
  result!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  failureDetail!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number, description: 'The agent’s own estimate.' })
  costUsd!: number | null;

  @ApiProperty()
  permissionDenials!: number;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The prompt the agent was given.',
  })
  prompt!: string | null;
}

export class AutomationRunResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  automationId!: string;

  @ApiProperty({ description: 'The automation’s name, kept when it is deleted.' })
  automationName!: string;

  @ApiProperty({ description: 'The automation was deleted; the list reads “Deleted automation”.' })
  automationDeleted!: boolean;

  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty({ enum: AUTOMATION_RUN_STATUSES })
  status!: AutomationRunStatus;

  @ApiProperty({
    enum: AUTOMATION_RUN_OUTCOMES,
    description: 'What became of the firing before a session.',
  })
  outcome!: AutomationRunOutcome;

  @ApiPropertyOptional(nullableEnum(AUTOMATION_SKIP_REASONS))
  skipReason!: AutomationSkipReason | null;

  @ApiProperty({ enum: AUTOMATION_RUN_CAUSES })
  cause!: AutomationRunCause;

  @ApiProperty({ type: RunCauseResponseDto })
  causeSummary!: RunCauseResponseDto;

  @ApiProperty({ example: 'Review #124 · Harden API config loading' })
  title!: string;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'uuid' })
  sessionId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The session’s working branch.',
  })
  branch!: string | null;

  @ApiProperty()
  revisionNumber!: number;

  @ApiProperty()
  agent!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  model!: string | null;

  @ApiProperty({ format: 'uuid' })
  hostId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ nullable: true, type: Date })
  scheduledFor!: Date | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  dispatchedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  startedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  endedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, type: Number, description: 'Milliseconds, once ended.' })
  durationMs!: number | null;

  @ApiPropertyOptional({ nullable: true, type: RunTurnResponseDto })
  turn!: RunTurnResponseDto | null;
}

export class RunStatusCountsResponseDto {
  @ApiProperty()
  all!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty({ description: 'Queued and running together, as the Running tab shows them.' })
  running!: number;
}

export class AutomationRunPageResponseDto {
  @ApiProperty({ type: [AutomationRunResponseDto] })
  items!: AutomationRunResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty({
    type: RunStatusCountsResponseDto,
    description: 'Per status tab, under the same facets but not the status filter.',
  })
  counts!: RunStatusCountsResponseDto;
}

export class RunHistoryDayResponseDto {
  @ApiProperty({ description: 'The local calendar day, `YYYY-MM-DD`.', example: '2026-09-25' })
  date!: string;

  @ApiProperty({
    description: 'Runs that did not fail, running ones included, as the chart counts them.',
  })
  succeeded!: number;

  @ApiProperty()
  failed!: number;
}

export class RunHistoryResponseDto {
  @ApiProperty({ type: [RunHistoryDayResponseDto], description: 'Oldest first, today last.' })
  days!: RunHistoryDayResponseDto[];

  @ApiProperty()
  succeeded!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ example: 'Europe/Madrid' })
  timezone!: string;
}

export class TriggerPreviewMatchResponseDto {
  @ApiProperty({ example: 'acme/xrp-mobile' })
  repository!: string;

  @ApiPropertyOptional({ example: '#124' })
  ref?: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'jordiparra' })
  actor?: string;

  @ApiPropertyOptional()
  url?: string;

  @ApiProperty()
  occurredAt!: Date;
}

export class TriggerPreviewResponseDto {
  @ApiProperty({ description: 'How many stored events the card matches in the window.' })
  count!: number;

  @ApiProperty()
  days!: number;

  @ApiProperty({ type: [TriggerPreviewMatchResponseDto], description: 'The two most recent.' })
  matches!: TriggerPreviewMatchResponseDto[];
}

export class AutomationSettingsResponseDto {
  @ApiProperty() maxRunsPerAutomationHour!: number;
  @ApiProperty() maxRunsPerWorkspaceHour!: number;
  @ApiProperty() liveRunsPerHost!: number;
  @ApiProperty({ enum: ['skip', 'queue'] }) overlap!: 'skip' | 'queue';
  @ApiProperty() staleTtlSeconds!: number;
  @ApiProperty() missedGraceSeconds!: number;
  @ApiProperty() maxRunSeconds!: number;
}
