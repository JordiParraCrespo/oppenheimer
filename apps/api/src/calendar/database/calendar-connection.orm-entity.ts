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
 * A person's Google Calendar grant (`product/versions/mvp/20-plan-calendar.md` §4),
 * one per Google account, up to five per person per workspace
 * (`23-plan-milestones-stats-accounts.md` §5). The account is keyed by Google's
 * `sub`; a row written before that has none, and at most one such row per person
 * exists (`1791000900000-AddCalendarAccounts`). The refresh token is sealed with AES-256-GCM under
 * `CALENDAR_TOKEN_KEY`; access tokens are minted per read and never stored, and no
 * calendar data is kept.
 */
@Entity('calendar_connection')
@Index(
  'UQ_calendar_connection_user_account',
  ['organizationId', 'userId', 'provider', 'accountSubject'],
  { unique: true, where: '"accountSubject" IS NOT NULL' },
)
@Index('UQ_calendar_connection_user_unkeyed', ['organizationId', 'userId', 'provider'], {
  unique: true,
  where: '"accountSubject" IS NULL',
})
@Index('IDX_calendar_connection_user', ['userId'])
@Check('CHK_calendar_connection_provider', `"provider" IN ('google')`)
@Check('CHK_calendar_connection_status', `"status" IN ('active', 'revoked')`)
@Check('CHK_calendar_connection_color_index', `"colorIndex" BETWEEN 0 AND 4`)
export class CalendarConnectionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: 'google';

  @Column({ type: 'varchar', length: 320 })
  accountEmail!: string;

  /** Google's `sub` for the account; null only on a row written before it was kept. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  accountSubject!: string | null;

  /** Which of the five account colours the month draws it in; never reassigned. */
  @Column({ type: 'smallint', default: 0 })
  colorIndex!: number;

  @Column({ type: 'bytea' })
  refreshTokenSealed!: Buffer;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  scopes!: string[];

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: 'active' | 'revoked';

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
