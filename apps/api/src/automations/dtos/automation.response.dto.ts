import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AUTOMATION_PAUSED_REASONS,
  AUTOMATION_PERMISSIONS,
  AUTOMATION_RUN_STATUSES,
  type AutomationPausedReason,
  type AutomationPermission,
  type AutomationRunStatus,
  GITHUB_EVENT_TYPES,
  SCHEDULE_FREQUENCIES,
  type ScheduleFrequency,
  TRIGGER_SOURCES,
  type TriggerSource,
} from '@oppenheimer/shared/automations';

export class AutomationRepositoryResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The installation its tokens are minted through.' })
  installationId!: string;

  @ApiProperty({
    description: 'GitHub’s repository id, as a string (a bigint).',
    example: '821374923',
  })
  githubRepoId!: string;

  @ApiProperty({
    description: '`owner/repo`, as it was when the revision was saved.',
    example: 'acme/xrp-mobile',
  })
  fullName!: string;
}

export class AutomationRevisionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'Numbered from 1; each save that changes what a run executes adds one.',
  })
  number!: number;

  @ApiProperty({ format: 'uuid' })
  hostId!: string;

  @ApiProperty({ example: 'claude-code' })
  agent!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  model!: string | null;

  @ApiProperty({ enum: AUTOMATION_PERMISSIONS })
  permission!: AutomationPermission;

  @ApiPropertyOptional({ nullable: true, type: String })
  effort!: string | null;

  @ApiProperty({ description: 'The instructions every run is given.' })
  prompt!: string;

  @ApiProperty({ type: [AutomationRepositoryResponseDto] })
  repositories!: AutomationRepositoryResponseDto[];

  @ApiProperty()
  createdAt!: Date;
}

export class TriggerFilterResponseDto {
  @ApiProperty({ enum: ['any', 'equals'] })
  op!: 'any' | 'equals';

  @ApiPropertyOptional({ description: 'The branch or label, when `op` is `equals`.' })
  value?: string;
}

export class ScheduleResponseDto {
  @ApiProperty({ enum: SCHEDULE_FREQUENCIES })
  frequency!: ScheduleFrequency;

  @ApiProperty({ minimum: 0, maximum: 23 })
  hour!: number;

  @ApiProperty({ minimum: 0, maximum: 59 })
  minute!: number;

  @ApiPropertyOptional({ type: [Number], description: 'Weekly: 0 = Sunday … 6 = Saturday.' })
  days?: number[];

  @ApiPropertyOptional({ minimum: 1, maximum: 28 })
  dayOfMonth?: number;

  @ApiPropertyOptional({ description: 'Once: the local date, `YYYY-MM-DD`.' })
  date?: string;

  @ApiProperty({ description: 'The IANA zone the wall time is in.', example: 'Europe/Madrid' })
  timezone!: string;
}

export class AutomationTriggerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'The card’s place in the editor, from 0.' })
  position!: number;

  @ApiProperty({ enum: TRIGGER_SOURCES })
  source!: TriggerSource;

  // The enum is the contract: a trigger is written only through the catalog
  // (`externalEventDefinition`), so a stored event is always one of these.
  @ApiProperty({
    enum: ['schedule', ...GITHUB_EVENT_TYPES],
    description: '`schedule`, or the catalog event (`pr_opened`, `push`, …).',
  })
  event!: string;

  @ApiPropertyOptional({ type: ScheduleResponseDto })
  schedule?: ScheduleResponseDto;

  @ApiPropertyOptional({ type: [String], description: 'GitHub: the repositories it listens on.' })
  repositories?: string[];

  @ApiPropertyOptional({ type: TriggerFilterResponseDto })
  filter?: TriggerFilterResponseDto;

  @ApiPropertyOptional({ nullable: true, type: Date, description: 'Schedule: the next slot, UTC.' })
  nextFireAt!: Date | null;
}

export class AutomationRunSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'The name the agent gave the session, or the automation’s name and cause.',
  })
  title!: string;

  @ApiProperty({ enum: AUTOMATION_RUN_STATUSES })
  status!: AutomationRunStatus;

  @ApiProperty({
    format: 'uuid',
    type: String,
    nullable: true,
    description: 'The session the run started — the run view — or null while queued or skipped.',
  })
  sessionId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class AutomationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Whose runs these are: every run acts as this person.',
  })
  ownerUserId!: string;

  @ApiProperty({ description: 'Whether the caller owns it.' })
  ownedByMe!: boolean;

  @ApiProperty({ example: 'Review new pull requests' })
  name!: string;

  @ApiProperty({
    enum: ['active', 'paused', 'running'],
    description: '`running` while any run is live, else `active` or `paused`.',
  })
  status!: 'active' | 'paused' | 'running';

  @ApiPropertyOptional({ nullable: true, type: Date })
  pausedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, enum: AUTOMATION_PAUSED_REASONS })
  pausedReason!: AutomationPausedReason | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Date,
    description: 'The earliest next slot of its schedule triggers. Null when paused or event-only.',
  })
  nextRunAt!: Date | null;

  @ApiProperty({ type: AutomationRevisionResponseDto })
  revision!: AutomationRevisionResponseDto;

  @ApiProperty({ type: [AutomationTriggerResponseDto] })
  triggers!: AutomationTriggerResponseDto[];

  @ApiPropertyOptional({ nullable: true, enum: ['skip', 'queue'] })
  overlap!: 'skip' | 'queue' | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  maxRunsPerHour!: number | null;

  @ApiProperty({
    description: 'Send it back on a save; a stale one is refused (`AUTOMATIONS_003`).',
  })
  version!: number;

  @ApiProperty({ description: 'Runs that became sessions, over the listed window.' })
  runCount!: number;

  @ApiProperty({
    type: [AutomationRunSummaryResponseDto],
    description: 'The last six, newest first.',
  })
  lastRuns!: AutomationRunSummaryResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
