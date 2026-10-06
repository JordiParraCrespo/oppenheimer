import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PULL_REQUEST_LANES,
  PULL_REQUEST_SCOPES,
  type PullRequestLane,
  type PullRequestScope,
} from '@oppenheimer/shared';

const LANE_REASONS = [
  'risky_path',
  'large_change',
  'docs_tests_config',
  'small_change',
  'medium_change',
  'files_unread',
] as const;
const BLOCKERS = [
  'draft',
  'conflicts',
  'checks_failing',
  'checks_running',
  'checks_unavailable',
  'changes_requested',
  'behind',
  'approval_required',
] as const;
const CHECK_STATES = ['passing', 'failing', 'running', 'none', 'unavailable'] as const;
const REFUSALS = ['forbidden', 'not_found', 'rate_limited', 'failed'] as const;
const GATE_STATES = ['done', 'failed', 'pending'] as const;

/** Why the lane policy put a pull request where it is; the console words it. */
export class PullRequestLaneReasonDto {
  @ApiProperty({ enum: LANE_REASONS })
  code!: (typeof LANE_REASONS)[number];

  @ApiPropertyOptional({ description: 'The risky directory, for `risky_path`.', example: 'auth/' })
  path?: string;

  @ApiPropertyOptional({ description: 'Changed lines, additions and deletions together.' })
  lines?: number;

  @ApiPropertyOptional()
  files?: number;
}

/** One row of the queue. */
export class PullRequestRowDto {
  @ApiProperty({ format: 'uuid', description: 'The installation that reaches the repository.' })
  installationId!: string;

  @ApiProperty()
  githubRepoId!: number;

  @ApiProperty({ example: 'acme-labs/xrp-mobile' })
  repository!: string;

  @ApiProperty()
  number!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty({ description: 'A GitHub login.' })
  author!: string;

  @ApiProperty({
    enum: ['session', 'person'],
    description: 'A session’s when its branch is one a session pushed.',
  })
  authorKind!: 'session' | 'person';

  @ApiProperty({ example: 'oppenheimer/keychain-tokens' })
  headRef!: string;

  @ApiProperty({ enum: PULL_REQUEST_SCOPES })
  scope!: PullRequestScope;

  @ApiProperty({ enum: PULL_REQUEST_LANES })
  lane!: PullRequestLane;

  @ApiProperty({ type: PullRequestLaneReasonDto })
  laneReason!: PullRequestLaneReasonDto;

  @ApiProperty()
  additions!: number;

  @ApiProperty()
  deletions!: number;

  @ApiProperty({
    enum: CHECK_STATES,
    description: '`unavailable`: GitHub would not show them, and `checksRefusal` says why.',
  })
  checks!: (typeof CHECK_STATES)[number];

  @ApiProperty({
    enum: REFUSALS,
    nullable: true,
    description: 'Why `checks` is `unavailable`; null when GitHub showed them.',
  })
  checksRefusal!: (typeof REFUSALS)[number] | null;

  @ApiProperty({
    enum: ['files', 'reviews'],
    isArray: true,
    description:
      'What GitHub did not give on this read: unread files make the lane size-only, unread reviews leave the review gate pending.',
  })
  unread!: ('files' | 'reviews')[];

  @ApiProperty({
    description: 'False on a conflict with the base; true while GitHub is still computing it.',
  })
  mergeable!: boolean;

  @ApiPropertyOptional({
    enum: BLOCKERS,
    nullable: true,
    description: 'What holds it, or null when it can merge.',
  })
  blocker!: (typeof BLOCKERS)[number] | null;

  @ApiProperty({ description: 'Seconds since it was opened.' })
  waitingSeconds!: number;

  @ApiProperty()
  draft!: boolean;

  @ApiProperty({ example: 'https://github.com/acme-labs/xrp-mobile/pull/12' })
  htmlUrl!: string;
}

export class PullRequestScopeCountsDto {
  @ApiProperty()
  mine!: number;

  @ApiProperty()
  requested!: number;

  @ApiProperty()
  watching!: number;
}

export class PullRequestLaneCountsDto {
  @ApiProperty()
  deep!: number;

  @ApiProperty()
  medium!: number;

  @ApiProperty()
  quick!: number;
}

const READ_GAPS = ['repository', 'pull_requests', 'files', 'checks', 'reviews'] as const;

/** Something GitHub did not give on this read: which repository, what, and the refusal GitHub gave. */
export class UnreadableRepositoryDto {
  @ApiProperty({ example: 'acme-labs/xrp-mobile' })
  fullName!: string;

  @ApiProperty({
    enum: READ_GAPS,
    description:
      '`repository`: its pull requests could not be listed; `pull_requests`: some could not be read; the rest: that part of some of them.',
  })
  what!: (typeof READ_GAPS)[number];

  @ApiProperty({
    enum: REFUSALS,
    description: 'The refusal GitHub gave: no access, gone, wait, or no answer.',
  })
  refusal!: (typeof REFUSALS)[number];
}

/** `GET /pulls`: one scope's queue, with what the header and the scope and lane controls count. */
export class PullRequestQueueResponseDto {
  @ApiProperty({ type: [PullRequestRowDto], description: 'Longest wait first.' })
  items!: PullRequestRowDto[];

  @ApiProperty({ type: PullRequestScopeCountsDto })
  scopes!: PullRequestScopeCountsDto;

  @ApiProperty({ type: PullRequestLaneCountsDto, description: 'Within the scope asked for.' })
  lanes!: PullRequestLaneCountsDto;

  @ApiProperty({ description: 'In the scope asked for, nothing holds them.' })
  readyToMerge!: number;

  @ApiProperty()
  withConflicts!: number;

  @ApiPropertyOptional({ nullable: true, type: Number })
  oldestWaitingSeconds!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'The caller’s GitHub login; null until they connect GitHub, and nothing is done in their name.',
  })
  viewerLogin!: string | null;

  @ApiProperty({
    type: [UnreadableRepositoryDto],
    description: 'Watched repositories this read could not fully answer.',
  })
  unreadable!: UnreadableRepositoryDto[];
}

export class PullRequestGateDto {
  @ApiProperty({ enum: ['checks', 'conflicts', 'review', 'merge'] })
  id!: 'checks' | 'conflicts' | 'review' | 'merge';

  @ApiProperty({ enum: GATE_STATES })
  state!: (typeof GATE_STATES)[number];
}

export class PullRequestChecksDto {
  @ApiProperty({ enum: CHECK_STATES })
  state!: (typeof CHECK_STATES)[number];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  passed!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  pending!: number;
}

export class PullRequestReviewerDto {
  @ApiProperty()
  login!: string;

  @ApiProperty({ enum: ['approved', 'changes_requested', 'commented', 'requested'] })
  state!: 'approved' | 'changes_requested' | 'commented' | 'requested';
}

/** `GET /pulls/…`: the briefing. */
export class PullRequestDetailResponseDto extends PullRequestRowDto {
  @ApiProperty({ description: 'The description, as written (Markdown).' })
  body!: string;

  @ApiProperty()
  baseRef!: string;

  @ApiProperty({ enum: ['open', 'merged', 'closed'] })
  state!: 'open' | 'merged' | 'closed';

  @ApiProperty()
  changedFiles!: number;

  @ApiProperty({
    type: [String],
    description: 'The top-level directories it touches, most files first.',
  })
  folders!: string[];

  @ApiProperty({ type: PullRequestChecksDto })
  checkCounts!: PullRequestChecksDto;

  @ApiProperty({ type: [PullRequestGateDto] })
  gates!: PullRequestGateDto[];

  @ApiProperty({ type: [PullRequestReviewerDto] })
  reviewers!: PullRequestReviewerDto[];

  @ApiPropertyOptional({ nullable: true, type: String })
  viewerLogin!: string | null;
}

export class PullRequestFileDto {
  @ApiProperty()
  path!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  previousPath!: string | null;

  @ApiProperty({ example: 'modified' })
  status!: string;

  @ApiProperty()
  additions!: number;

  @ApiProperty()
  deletions!: number;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The unified diff; null for a binary file or one GitHub will not show.',
  })
  patch!: string | null;
}

export class PullRequestCommentDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  path!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  line!: number | null;

  @ApiProperty({ enum: ['LEFT', 'RIGHT'] })
  side!: 'LEFT' | 'RIGHT';

  @ApiProperty()
  body!: string;

  @ApiProperty()
  author!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class WatchedRepositoryDto {
  @ApiProperty({ format: 'uuid' })
  installationId!: string;

  @ApiProperty()
  githubRepoId!: number;

  @ApiProperty({ example: 'acme-labs/xrp-mobile' })
  fullName!: string;

  @ApiProperty()
  private!: boolean;

  @ApiProperty({ description: 'Not watched until the caller switches it on.' })
  watching!: boolean;
}
