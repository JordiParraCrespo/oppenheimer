import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { nullableEnum } from '@oppenheimer/backend-core';
import {
  AUTOMATION_PAUSED_REASONS,
  type AutomationPausedReason,
} from '@oppenheimer/shared/automations';
import {
  AutomationRunSummaryResponseDto,
  AutomationTriggerResponseDto,
} from './automation.response.dto';

/**
 * One of a bot's routines as its Routines tab reads it (`26-bot-routines.md`
 * §7): what it is told, when it runs, whether it is on, and how it last went.
 * Where and how it runs are its bot's, so it has no host, agent or project.
 */
export class BotRoutineResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Morning PR digest' })
  name!: string;

  @ApiProperty({ description: 'What the bot is told each time it runs.' })
  prompt!: string;

  @ApiProperty({
    enum: ['active', 'paused', 'running'],
    description: '`running` while a run is queued or its turn runs, else `active` or `paused`.',
  })
  status!: 'active' | 'paused' | 'running';

  @ApiPropertyOptional(nullableEnum(AUTOMATION_PAUSED_REASONS))
  pausedReason!: AutomationPausedReason | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Date,
    description: 'The earliest next slot of its schedules. Null when paused or event-only.',
  })
  nextRunAt!: Date | null;

  @ApiProperty({ type: [AutomationTriggerResponseDto] })
  triggers!: AutomationTriggerResponseDto[];

  @ApiPropertyOptional({
    nullable: true,
    type: AutomationRunSummaryResponseDto,
    description: 'Its latest run over the listed window; null when it has none.',
  })
  lastRun!: AutomationRunSummaryResponseDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
