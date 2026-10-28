import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { nullableEnum, PaginatedResponseDto } from '@oppenheimer/backend-core';
import type {
  CloudAgentProviderId,
  CloudAgentStatus,
  SessionAgentId,
  SessionEffortDto,
  SessionPermissionDto,
  SessionPlace,
} from '@oppenheimer/shared';
import {
  CLOUD_AGENT_PROVIDERS,
  CLOUD_AGENT_STATUSES,
  SESSION_AGENT_IDS,
  SESSION_EFFORTS,
  SESSION_GROUPS,
  SESSION_PERMISSIONS,
  SESSION_PLACES,
  SESSION_STATES,
} from '@oppenheimer/shared';
import {
  type SessionDecisionResponseDto,
  SessionPermissionDecisionResponseDto,
  SessionQuestionDecisionResponseDto,
} from './session-decision.response.dto';

/**
 * One repository checked out for this session.
 *
 * `repositoryFullName`, `baseBranch` and `branch` are here rather than on the session
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
    example: 'oppenheimer/bold-otter-3f9a7k',
  })
  branch!: string;
}

/**
 * How the agent was started.
 *
 * It is on the read as well as the write because the console shows the engine
 * button on a session that already exists, and because a restart has to
 * reproduce the launch (`product/versions/mvp/03-control-plane.md`). What each
 * value means to a given CLI is catalog data in `@oppenheimer/shared`, not
 * something this API translates.
 */
export class SessionLaunchResponseDto {
  @ApiPropertyOptional({
    description: 'The model the agent was launched with; null runs that agent’s own default.',
    nullable: true,
    type: String,
    example: 'opus',
  })
  model!: string | null;

  @ApiProperty({
    ...nullableEnum(SESSION_PERMISSIONS),
    description:
      'What the agent may do on the host without asking. `full` is the one level that changes a machine unattended, and is never a remembered default. Null for an agent with no approvals (the blank terminal).',
  })
  permission!: SessionPermissionDto | null;

  @ApiPropertyOptional({
    ...nullableEnum(SESSION_EFFORTS),
    description: 'How hard the agent may think. Null leaves the agent its own default.',
  })
  effort!: SessionEffortDto | null;
}

/**
 * A close the host has not answered yet. A close is a request the host carries out,
 * so a deleted session stays unresolved until it does; while this is set the console
 * draws the row as deleting, and the host's next hello is sent the close again.
 */
export class SessionCloseRequestResponseDto {
  @ApiProperty({ description: 'When the close was asked for.' })
  requestedAt!: Date;

  @ApiProperty({ description: 'Whether the close may remove a worktree with unpushed work.' })
  acceptUnpushedWork!: boolean;
}

/** The host's refusal of the last close, until it is asked again or the session restarts. */
export class SessionCloseRefusalResponseDto {
  @ApiProperty({
    description: 'The runner’s catalog code, e.g. `GIT_003` for a branch that could not be pushed.',
    example: 'GIT_003',
  })
  code!: string;

  @ApiPropertyOptional({
    description: 'Git’s or the runner’s own words, verbatim.',
    nullable: true,
    type: String,
  })
  detail!: string | null;
}

/**
 * A cloud session's vendor half: whose agent it is, its page, and what the
 * vendor last said about its run. The session's `state` is the fold of what
 * that said; this is what a row shows beside it and opens.
 */
export class SessionCloudRunResponseDto {
  @ApiProperty({ enum: CLOUD_AGENT_PROVIDERS, example: 'cursor' })
  provider!: CloudAgentProviderId;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The agent’s own page at the vendor, where it is followed up, stopped or deleted.',
    example: 'https://cursor.com/agents?id=bc-6f1c…',
  })
  url!: string | null;

  @ApiProperty({ example: 'https://github.com/acme/api' })
  repositoryUrl!: string;

  @ApiProperty({
    enum: CLOUD_AGENT_STATUSES,
    description: 'Where the vendor said the latest run stands, when it was last asked.',
  })
  status!: CloudAgentStatus;

  @ApiProperty({ nullable: true, type: String, description: 'The branch the agent pushed.' })
  branch!: string | null;

  @ApiProperty({ nullable: true, type: String })
  pullRequestUrl!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When the vendor was last asked.',
  })
  syncedAt!: Date;
}

@ApiExtraModels(SessionQuestionDecisionResponseDto, SessionPermissionDecisionResponseDto)
export class SessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid', description: 'The project the session is listed under.' })
  projectId!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'The host it runs on; null for a cloud session, which runs at its vendor.',
  })
  hostId!: string | null;

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

  @ApiProperty({
    enum: SESSION_AGENT_IDS,
    description:
      'The coding agent this session runs: one a host launches, or a vendor’s own in the cloud (`cursor`).',
    example: 'claude-code',
  })
  agent!: SessionAgentId;

  @ApiProperty({
    enum: SESSION_PLACES,
    description:
      "Where the session runs: `worktree`, a checkout the runner made for each repository, `folder`, a folder already on the host, where nothing is cloned or written (`product/versions/mvp/24-session-places.md`), or `cloud`, a vendor's cloud: Claude Code's, started from the host and living on claude.ai/code, or one the control plane launched with no host (Cursor's, with `cloud` set).",
    example: 'worktree',
  })
  place!: SessionPlace;

  @ApiPropertyOptional({
    description:
      'The absolute path on the host a folder session runs in. Null for a worktree session.',
    nullable: true,
    type: String,
    example: '/home/jordi/notes',
  })
  folderPath!: string | null;

  @ApiPropertyOptional({
    description:
      "A cloud session's Claude Code id, once its host has started it: claude.ai/code/<id> opens it and `claude --teleport <id>` brings it to a terminal. Null for every other place, and before the start.",
    nullable: true,
    type: String,
    example: 'session_014a8EH8DJs95X1iK8ZH9Y82',
  })
  cloudSessionId!: string | null;

  @ApiProperty({ type: SessionLaunchResponseDto })
  launch!: SessionLaunchResponseDto;

  @ApiProperty({
    enum: SESSION_GROUPS,
    description:
      'The derived group the sidebar dot shows, computed from the row by `sessionGroup` (`product/versions/mvp/03-control-plane.md`).',
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
    description:
      'When the agent entered the state it was last observed in (`blocked`, `working`…); null until a second report of that state is recorded. A blocked wait is named by it (the Inbox, `product/versions/mvp/29-inbox.md` §3).',
    nullable: true,
    type: Date,
  })
  observedSince!: Date | null;

  @ApiProperty({
    description:
      'Bumped on every change of `lifecycle`, so one failure or one launch is told apart from the next (the Inbox keys a failed or stuck session by it).',
  })
  stateSeq!: number;

  @ApiPropertyOptional({
    description: 'When the agent and the tmux session last ended. The checkouts stay on disk.',
    nullable: true,
    type: Date,
  })
  stoppedAt!: Date | null;

  @ApiProperty({ type: [SessionCheckoutResponseDto] })
  checkouts!: SessionCheckoutResponseDto[];

  @ApiProperty({
    type: SessionCloudRunResponseDto,
    nullable: true,
    description: 'A cloud session’s vendor half; null for a session on a host.',
  })
  cloud!: SessionCloudRunResponseDto | null;

  @ApiProperty({
    isArray: true,
    type: String,
    description:
      'What the control plane could not do for this request. Empty on a read; `host_offline` means the command was recorded but no link to the host exists, so the work is owed.',
    example: [],
  })
  hints!: string[];

  @ApiPropertyOptional({
    type: SessionCloseRequestResponseDto,
    nullable: true,
    description: 'A close owed to the host and not yet answered. Null when none is.',
  })
  closeRequest!: SessionCloseRequestResponseDto | null;

  @ApiPropertyOptional({
    type: SessionCloseRefusalResponseDto,
    nullable: true,
    description:
      'Why the host refused the last close. Null when it did not, or it was asked again.',
  })
  closeRefusal!: SessionCloseRefusalResponseDto | null;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(SessionQuestionDecisionResponseDto) },
      { $ref: getSchemaPath(SessionPermissionDecisionResponseDto) },
    ],
    nullable: true,
    description:
      'What the agent waits on you for, by `kind`: a question it asked, or a permission dialog. Null when nothing is pending. Answer it with `POST /sessions/{id}/decision`.',
  })
  decision!: SessionDecisionResponseDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

/**
 * Where the caller is in the result set. Page mode answers the counts; cursor
 * mode answers only `limit` and `nextCursor`, because a cursor walk never counts.
 */
export class SessionPageMetaDto {
  @ApiProperty({
    required: false,
    description:
      'Total matching sessions, across all pages. Page mode only: absent when `cursor` was sent.',
    example: 42,
  })
  total?: number;

  @ApiProperty({
    required: false,
    description: '1-based page number. Page mode only: absent when `cursor` was sent.',
    example: 1,
  })
  page?: number;

  @ApiProperty({ description: 'Sessions per page.', example: 20 })
  limit!: number;

  @ApiProperty({
    required: false,
    description: 'Page mode only: absent when `cursor` was sent.',
    example: 3,
  })
  totalPages?: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Send it back as `cursor`, with the same `sort`, for the page after this one. Null on the last page. Present in both modes.',
  })
  nextCursor!: string | null;
}

export class PaginatedSessionsResponseDto extends PaginatedResponseDto(
  SessionResponseDto,
  SessionPageMetaDto,
) {}

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

export class SessionPreviewResponseDto {
  @ApiProperty({
    description:
      "Where the preview opens: the port's own origin under the deployment's preview domain, carrying a single-use ticket that lives 60 seconds. Open it in the Browser tab's frame or a tab of its own; the origin keeps the reader in a cookie of its own from there.",
    example:
      'http://p5173-3f0d9e2c6a4b4e9a9c3d7b1e5a2f8c40.preview.localhost:3011/__oppenheimer/enter?ticket=…&path=%2F&embed=1',
  })
  url!: string;

  @ApiProperty({ description: 'The ticket in `url` is refused after this.' })
  expiresAt!: Date;
}

export class SessionPortDto {
  @ApiProperty({ example: 5173 })
  port!: number;

  @ApiProperty({ required: false, description: 'The command listening on it.', example: 'node' })
  process?: string;
}

export class SessionPortsResponseDto {
  @ApiProperty({
    enum: ['listed', 'host_offline', 'not_supported'],
    description:
      '`listed`: `ports` is what the session listens on now. `host_offline`: the host has no link. `not_supported`: its runner cannot list ports.',
  })
  state!: 'listed' | 'host_offline' | 'not_supported';

  @ApiProperty({
    type: [SessionPortDto],
    description: 'The TCP ports the session’s own processes listen on, from 1024 up, in order.',
  })
  ports!: SessionPortDto[];
}
