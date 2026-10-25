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

/** A bot following work it delegated (`1791003300000-AddBotSubscriptions`). */
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
@Check('CHK_bot_subscription_resource_kind', `"resourceKind" IN ('session')`)
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

  /** The followed resource; no foreign key, it is polymorphic over `resourceKind`. */
  @Column({ type: 'uuid' })
  resourceId!: string;

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

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
