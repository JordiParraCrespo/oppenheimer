import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One model's tokens over the period. */
export class PlanStatsModelTokensDto {
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The model the turns ran on; null when the agent did not say.',
    example: 'claude-sonnet-4-5',
  })
  model!: string | null;

  @ApiProperty({ description: 'Input plus output tokens over the period.' })
  total!: number;

  @ApiProperty({ type: [Number], description: 'Per week, in the order of `weeks`.' })
  byWeek!: number[];
}

/** The headline numbers of one period. */
export class PlanStatsTotalsDto {
  @ApiProperty()
  tasksCompleted!: number;

  @ApiProperty()
  tasksCreated!: number;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'Input plus output tokens of the turns that reported usage; null when none did.',
  })
  tokens!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'What the agents reported the turns cost, in US dollars; null when none did.',
  })
  costUsd!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'Pull requests merged; null while pull requests are not counted on Plan.',
  })
  pullRequestsMerged!: number | null;
}

/** The current period: its totals and its series per week. */
export class PlanStatsPeriodDto extends PlanStatsTotalsDto {
  @ApiProperty({ type: [Number] })
  completedByWeek!: number[];

  @ApiProperty({ type: [Number] })
  createdByWeek!: number[];

  @ApiPropertyOptional({ nullable: true, type: [PlanStatsModelTokensDto] })
  tokensByModel!: PlanStatsModelTokensDto[] | null;

  @ApiPropertyOptional({ nullable: true, type: [Number] })
  costByWeek!: number[] | null;
}

/** One project's row in the table. */
export class PlanStatsProjectDto {
  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty()
  tasksCompleted!: number;

  @ApiPropertyOptional({ nullable: true, type: Number })
  tokens!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  costUsd!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  pullRequestsMerged!: number | null;
}

export class PlanStatsResponseDto {
  @ApiProperty({ type: String, format: 'date' })
  from!: string;

  @ApiProperty({ type: String, format: 'date' })
  to!: string;

  @ApiProperty({ example: 'Europe/Madrid' })
  timeZone!: string;

  @ApiProperty({
    type: [String],
    description:
      'The Mondays of the weeks the period touches, oldest first; every series follows them.',
  })
  weeks!: string[];

  @ApiProperty({ type: PlanStatsPeriodDto })
  current!: PlanStatsPeriodDto;

  @ApiPropertyOptional({
    nullable: true,
    type: PlanStatsTotalsDto,
    description: 'The period of the same length just before `from`; null without `compare`.',
  })
  previous!: PlanStatsTotalsDto | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date' })
  previousFrom!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date' })
  previousTo!: string | null;

  @ApiProperty({
    type: [PlanStatsProjectDto],
    description: 'Projects with any activity in the period.',
  })
  projects!: PlanStatsProjectDto[];

  @ApiProperty({
    enum: ['headless', 'none'],
    description:
      '`headless`: tokens and cost count the turns that report usage (headless ones); interactive turns in a terminal report none yet.',
  })
  tokensMeasured!: 'headless' | 'none';
}
