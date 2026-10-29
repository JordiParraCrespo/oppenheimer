import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A pattern a session's runner watches its screen for, and the newest count
 * it reported. See `1791004800000-AddTerminalWatches` for why it is shaped
 * this way.
 */
@Entity('session_terminal_watch')
@Check('CHK_session_terminal_watch_pattern', `char_length("pattern") > 0`)
@Check('CHK_session_terminal_watch_matches', `"matches" >= 0`)
@Index('IDX_session_terminal_watch_session', ['organizationId', 'sessionId'])
export class SessionTerminalWatchOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'varchar', length: 200 })
  pattern!: string;

  /** The newest count of matching lines the runner reported; 0 before any. */
  @Column({ type: 'integer', default: 0 })
  matches!: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
