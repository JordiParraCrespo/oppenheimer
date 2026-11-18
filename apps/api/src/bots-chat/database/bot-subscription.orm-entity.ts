import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A bot following work it delegated (`1791003300000-AddBotSubscriptions`), a
 * session or a pull request (`1793707588046-AddBotPullRequestSubscriptions`),
 * or the tasks of a project or a milestone (`1794641550969-AddBotPlanSubscriptions`).
 */
@Entity('bot_subscription')
@Index(
  'UQ_bot_subscription_bot_resource',
  ['organizationId', 'botId', 'resourceKind', 'resourceId'],
  {
    unique: true,
  },
)
@Index('IDX_bot_subscription_resource', ['organizationId', 'resourceKind', 'resourceId'])
@Index('IDX_bot_subscription_origin_turn', ['organizationId', 'originTurnId'], {
  where: '"originTurnId" IS NOT NULL',
})
@Index(
  'UQ_bot_subscription_bot_pull_request',
  ['organizationId', 'botId', 'githubRepoId', 'pullNumber'],
  { unique: true, where: `"resourceKind" = 'pull_request'` },
)
@Index('IDX_bot_subscription_pull_request', ['organizationId', 'githubRepoId', 'pullNumber'], {
  where: `"resourceKind" = 'pull_request'`,
})
@Check(
  'CHK_bot_subscription_resource_kind',
  `"resourceKind" IN ('session', 'pull_request', 'project', 'milestone')`,
)
@Check(
  'CHK_bot_subscription_subject',
  `("resourceKind" = 'session' AND "resourceId" IS NOT NULL AND num_nonnulls("githubRepoId", "pullNumber", "repositoryFullName", "taskEvents") = 0) OR ("resourceKind" = 'pull_request' AND "resourceId" IS NULL AND "githubRepoId" IS NOT NULL AND "githubRepoId" > 0 AND "pullNumber" IS NOT NULL AND "pullNumber" >= 1 AND "repositoryFullName" IS NOT NULL AND char_length("repositoryFullName") > 0 AND "taskEvents" IS NULL AND "until" = 'closed' AND "terminalWatchId" IS NULL) OR ("resourceKind" IN ('project', 'milestone') AND "resourceId" IS NOT NULL AND num_nonnulls("githubRepoId", "pullNumber", "repositoryFullName") = 0 AND "taskEvents" IS NOT NULL AND jsonb_typeof("taskEvents") = 'array' AND jsonb_array_length("taskEvents") > 0 AND "until" = 'closed' AND "terminalWatchId" IS NULL)`,
)
@Check('CHK_bot_subscription_until', `"until" IN ('task', 'closed')`)
@Check(
  'CHK_bot_subscription_watched_turn',
  `("until" = 'task') = ("watchedTurn" IS NOT NULL) AND ("watchedTurn" IS NULL OR "watchedTurn" >= 1)`,
)
@Check('CHK_bot_subscription_purpose', `purpose IS NULL OR char_length(purpose) > 0`)
@Check(
  'CHK_bot_subscription_credential_scopes',
  `"credentialScopes" IS NULL OR jsonb_typeof("credentialScopes") = 'array'`,
)
@Check(
  'CHK_bot_subscription_last',
  `num_nonnulls("lastTurn", "lastState") <> 1 AND ("lastState" IS NULL OR "lastState" IN ('requires_action', 'completed', 'failed', 'cancelled', 'expired'))`,
)
@Check('CHK_bot_subscription_wakes', `wakes >= 0`)
@Check('CHK_bot_subscription_pattern', `("terminalWatchId" IS NULL) = ("pattern" IS NULL)`)
@Check('CHK_bot_subscription_matches', `"matches" >= 0`)
@Index('IDX_bot_subscription_terminal_watch', ['terminalWatchId'], {
  where: '"terminalWatchId" IS NOT NULL',
})
@Check('CHK_bot_subscription_version', `version >= 1`)
export class BotSubscriptionOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_bot_subscription' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 32 })
  resourceKind!: string;

  /**
   * The followed session, project or milestone; no foreign key, it is
   * polymorphic over `resourceKind`. Null for a pull request.
   */
  @Column({ type: 'uuid', nullable: true })
  resourceId!: string | null;

  /** GitHub's repository id of a followed pull request, exchanged as a string: it is a bigint. */
  @Column({ type: 'bigint', nullable: true })
  githubRepoId!: string | null;

  @Column({ type: 'integer', nullable: true })
  pullNumber!: number | null;

  /** `owner/name` when the bot watched it, for its list and its wakes. */
  @Column({ type: 'varchar', length: 140, nullable: true })
  repositoryFullName!: string | null;

  /** The bot's turn that subscribed; null once its chat is cleared. */
  @Column({ type: 'uuid', nullable: true })
  originTurnId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  purpose!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'task' })
  until!: string;

  /** The task followed, for `until = 'task'`; null for every task. */
  @Column({ type: 'integer', nullable: true })
  watchedTurn!: number | null;

  /** The subscribing turn's credential scopes; null for a browser session. */
  @Column({ type: 'jsonb', nullable: true })
  credentialScopes!: string[] | null;

  /** The subscribing turn's IANA zone; null means UTC. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  timeZone!: string | null;

  /** The newest wake recorded: its task and state, both or neither. */
  @Column({ type: 'integer', nullable: true })
  lastTurn!: number | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  lastState!: string | null;

  @Column({ type: 'integer', default: 0 })
  wakes!: number;

  /** The sessions module's terminal watch behind `pattern`; no foreign key (see the migration). */
  @Column({ type: 'uuid', nullable: true })
  terminalWatchId!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  pattern!: string | null;

  @Column({ type: 'int', default: 0 })
  matches!: number;

  /** The task changes (`plan_event` kinds) that wake the bot, for a project or a milestone; null otherwise. */
  @Column({ type: 'jsonb', nullable: true })
  taskEvents!: string[] | null;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
