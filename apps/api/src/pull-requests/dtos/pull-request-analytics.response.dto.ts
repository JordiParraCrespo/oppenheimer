import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PULL_REQUEST_ANALYTICS_RANGES,
  PULL_REQUEST_LANES,
  type PullRequestAnalyticsRange,
  type PullRequestLane,
} from '@oppenheimer/shared';
import { UnreadableRepositoryDto } from './pull-request.response.dto';

/** A figure this period and the one before it. */
export class AnalyticsFigureDto {
  @ApiProperty()
  value!: number;

  @ApiProperty()
  previous!: number;
}

/** A median in hours, this period and the one before; null when nothing was measured. */
export class AnalyticsMedianDto {
  @ApiPropertyOptional({ nullable: true, type: Number })
  value!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  previous!: number | null;
}

export class AnalyticsDayDto {
  @ApiProperty({ format: 'date', example: '2026-10-04' })
  date!: string;

  @ApiProperty()
  created!: number;

  @ApiProperty()
  merged!: number;
}

export class AnalyticsLaneDto {
  @ApiProperty({ enum: PULL_REQUEST_LANES })
  lane!: PullRequestLane;

  @ApiProperty()
  value!: number;

  @ApiProperty()
  previous!: number;
}

export class AnalyticsWaitingDto {
  @ApiProperty({
    enum: [
      'draft',
      'conflicts',
      'checks_failing',
      'checks_running',
      'checks_unavailable',
      'changes_requested',
      'behind',
      'approval_required',
    ],
  })
  reason!: string;

  @ApiProperty({ description: 'Open pull requests held by it now.' })
  value!: number;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'Median hours they have been open.',
  })
  medianHours!: number | null;
}

/** `GET /pulls/analytics`: the watched repositories' review period against the one before. */
export class PullRequestAnalyticsResponseDto {
  @ApiProperty({ enum: PULL_REQUEST_ANALYTICS_RANGES })
  range!: PullRequestAnalyticsRange;

  @ApiProperty({ format: 'date-time' })
  from!: string;

  @ApiProperty({ format: 'date-time' })
  to!: string;

  @ApiProperty({ type: AnalyticsFigureDto })
  created!: AnalyticsFigureDto;

  @ApiProperty({ type: AnalyticsFigureDto })
  merged!: AnalyticsFigureDto;

  @ApiProperty({ type: AnalyticsFigureDto, description: 'Pull requests the caller reviewed.' })
  reviewedByYou!: AnalyticsFigureDto;

  @ApiProperty({
    type: AnalyticsMedianDto,
    description: 'Opened to first review by someone else, in hours.',
  })
  waitForReview!: AnalyticsMedianDto;

  @ApiProperty({
    type: AnalyticsMedianDto,
    description: 'Same, for pull requests sessions opened.',
  })
  waitForReviewAgents!: AnalyticsMedianDto;

  @ApiProperty({ type: AnalyticsMedianDto, description: 'Same, for pull requests people opened.' })
  waitForReviewPeople!: AnalyticsMedianDto;

  @ApiProperty({ type: AnalyticsMedianDto, description: 'Opened to merged, in hours.' })
  timeToMerge!: AnalyticsMedianDto;

  @ApiProperty({ type: [AnalyticsDayDto] })
  days!: AnalyticsDayDto[];

  @ApiProperty({ type: [AnalyticsLaneDto], description: 'Merged pull requests by lane.' })
  lanes!: AnalyticsLaneDto[];

  @ApiProperty({
    type: [AnalyticsWaitingDto],
    description: 'What holds the open pull requests now.',
  })
  waiting!: AnalyticsWaitingDto[];

  @ApiProperty({
    description:
      'False when more pull requests closed in the window than one read takes in full; the figures then count the most recently closed.',
  })
  complete!: boolean;

  @ApiProperty({ type: [UnreadableRepositoryDto] })
  unreadable!: UnreadableRepositoryDto[];
}
