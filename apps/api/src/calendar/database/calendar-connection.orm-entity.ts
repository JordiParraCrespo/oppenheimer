import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A person's Google Calendar grant (`product/versions/mvp/20-plan-calendar.md` §4):
 * one per person per workspace. The refresh token is sealed with AES-256-GCM under
 * `CALENDAR_TOKEN_KEY`; access tokens are minted per read and never stored, and no
 * calendar data is kept.
 */
@Entity('calendar_connection')
@Unique('UQ_calendar_connection_user', ['organizationId', 'userId', 'provider'])
@Index('IDX_calendar_connection_user', ['userId'])
@Check('CHK_calendar_connection_provider', `"provider" IN ('google')`)
@Check('CHK_calendar_connection_status', `"status" IN ('active', 'revoked')`)
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
