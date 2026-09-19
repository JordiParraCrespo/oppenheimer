import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SESSION_GROUPS, SESSION_STATES } from '@oppenheimer/shared';

/**
 * One repository checked out for this session.
 *
 * `repository`, `baseBranch` and `branch` are here rather than on the session
 * because with several checkouts they are per-checkout facts. The status line above
 * a terminal shows the cwd checkout's `repo · branch` plus a count.
 */
export class SessionCheckoutResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The GitHub installation this repository’s tokens are minted through.',
  })
  installationId!: string;

  @ApiProperty({
    description: 'GitHub’s repository id, as a string because the column is a bigint.',
    example: '821374923',
  })
  githubRepoId!: string;

  @ApiProperty({
    description: 'A display snapshot of `owner/repo`, refreshed whenever a checkout is created.',
    example: 'acme/xrp-mobile',
  })
  repositoryFullName!: string;

  @ApiProperty({
    description: 'The directory inside the session. Never reused, even after removal.',
    example: 'xrp-mobile',
  })
  directoryName!: string;

  @ApiPropertyOptional({
    description: 'What the runner named the bare store under `repos/`. Null until it reports.',
    nullable: true,
    type: String,
  })
  storeDirectoryName!: string | null;

  @ApiProperty({
    enum: ['worktree', 'clone'],
    description: 'Recorded rather than guessed: cleanup differs between the two.',
  })
  mode!: 'worktree' | 'clone';

  @ApiProperty({ description: 'What the session’s branch was created from.', example: 'main' })
  baseBranch!: string;

  @ApiProperty({
    description: 'Always the session’s own branch, never the base.',
    example: 'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
  })
  branch!: string;
}

export class SessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty({ format: 'uuid' })
  hostId!: string;

  @ApiProperty({
    description: 'Display name. It starts equal to the slug, then the first prompt names it.',
    example: 'Fix the wallet list empty state',
  })
  name!: string;

  @ApiProperty({
    description:
      'The session’s directory name and the last segment of its branch. Immutable, and never reissued.',
    example: 'bold-otter-3f9a7k',
  })
  slug!: string;

  @ApiProperty({ description: 'The coding agent this session runs.', example: 'claude-code' })
  agent!: string;

  @ApiProperty({
    enum: SESSION_GROUPS,
    description:
      'The derived group — what the sidebar dot shows, computed from the row and organised by what needs you: the session failed, the agent has been blocked for 30 s, or a launch has sat unready for 60 s. Two arms have no writer until the relay and the pull-request flow land: `landing`, and the fourth `waiting-on-you` source (the pane is gone with no report).',
  })
  state!: (typeof SESSION_GROUPS)[number];

  @ApiProperty({
    enum: SESSION_STATES,
    description:
      'The stored lifecycle: the fold of the session’s append-only log. It answers whether the work is finished, not whether a process is running — stopping a session does not move it.',
  })
  lifecycle!: (typeof SESSION_STATES)[number];

  @ApiPropertyOptional({
    description:
      'Which checkout the agent was launched inside. Null starts it in the session directory with every checkout a peer.',
    nullable: true,
    type: String,
    format: 'uuid',
  })
  cwdCheckoutId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  agentSessionId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  lastEventAt!: Date | null;

  @ApiPropertyOptional({
    description: 'When the agent and the tmux session last ended. The checkouts stay on disk.',
    nullable: true,
    type: Date,
  })
  stoppedAt!: Date | null;

  @ApiProperty({ type: [SessionCheckoutResponseDto] })
  checkouts!: SessionCheckoutResponseDto[];

  @ApiProperty({
    isArray: true,
    type: String,
    description:
      'What the control plane could not do for this request. Empty on a read; `host_offline` means the command was recorded but no link to the host exists, so the work is owed.',
    example: [],
  })
  hints!: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

/** Where the caller is in the result set. */
export class SessionPageMetaDto {
  @ApiProperty({ description: 'Total matching sessions, across all pages.', example: 42 })
  total!: number;

  @ApiProperty({ description: '1-based page number.', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Sessions per page.', example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PaginatedSessionsResponseDto {
  @ApiProperty({ type: [SessionResponseDto] })
  data!: SessionResponseDto[];

  @ApiProperty({ type: SessionPageMetaDto })
  meta!: SessionPageMetaDto;
}

/**
 * What `POST /sessions/{id}/attach-ticket` answers.
 *
 * The client presents `ticket` as a **WebSocket subprotocol**, never as a query
 * parameter: reverse proxies, CDNs and load balancers log request lines by
 * default, and this ticket buys an interactive shell. One ticket, one attach; every
 * reconnect mints a fresh one.
 */
export class AttachTicketResponseDto {
  @ApiProperty({
    description:
      'Single-use, 60 seconds. Present it in `Sec-WebSocket-Protocol` when opening the relay socket — never in the URL.',
  })
  ticket!: string;

  @ApiProperty({
    description: 'The path to open the WebSocket on, on this API’s own origin.',
    example: '/api/v1/relay/attach',
  })
  url!: string;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({
    description: 'The tmux window this ticket authorises. Tabs are tmux windows.',
    example: 0,
  })
  window!: number;
}
