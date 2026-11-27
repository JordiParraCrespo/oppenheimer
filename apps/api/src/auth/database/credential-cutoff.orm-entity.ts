import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * One row per account whose password was reset: every scoped credential whose
 * chain began before `issuedBefore` is refused (`predatesCutoff`). Written in
 * the reset's own transaction (`OAuthGrantRepository.revokeAllForUser`), read
 * on every scoped request (`CredentialCutoffRepository`) and by the OAuth
 * grant gate. The migration is `AddCredentialCutoff`.
 */
@Entity('credential_cutoff')
export class CredentialCutoffOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_credential_cutoff' })
  userId!: string;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  issuedBefore!: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
