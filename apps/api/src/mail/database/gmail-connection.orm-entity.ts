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
 * A person's Gmail grant (`product/next-steps/mail.md` §1), one per Google
 * account, up to five per person per workspace, keyed by Google's `sub`. The
 * refresh token is sealed with AES-256-GCM under `MAIL_TOKEN_KEY`; access
 * tokens are minted per call and never stored, and no mail is kept.
 */
@Entity('gmail_connection')
@Index('UQ_gmail_connection_user_account', ['organizationId', 'userId', 'googleSubject'], {
  unique: true,
})
@Index('IDX_gmail_connection_user', ['userId'])
@Check('CHK_gmail_connection_status', `"status" IN ('active', 'revoked')`)
export class GmailConnectionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  googleSubject!: string;

  @Column({ type: 'varchar', length: 320 })
  accountEmail!: string;

  @Column({ type: 'varchar', length: 64 })
  label!: string;

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
