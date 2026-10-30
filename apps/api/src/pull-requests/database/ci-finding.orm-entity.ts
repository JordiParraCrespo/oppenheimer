import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  CI_FINDING_ACTIONS,
  CI_FINDING_CHECK_MAX,
  CI_FINDING_CONFIDENCE,
  CI_FINDING_FLAKE,
  CI_FINDING_NEXT_MAX,
  CI_FINDING_RELATIONS,
  CI_FINDING_ROOT_CAUSE_MAX,
} from '@oppenheimer/shared';
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

/** A closed set as SQL, from the shared constants the schema reads too. */
function sqlList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

/**
 * What one failing check on a pull request's head came to
 * (`1791005200000-AddCiFindings`). The pull request is GitHub's, named by its
 * repository's id and its number; a second look at the same check on the same
 * commit replaces the first.
 */
@Entity('pull_request_ci_finding')
@Unique('UQ_pull_request_ci_finding', [
  'organizationId',
  'githubRepoId',
  'number',
  'headSha',
  'check',
])
@Index('IDX_pull_request_ci_finding_user', ['recordedByUserId'], {
  where: '"recordedByUserId" IS NOT NULL',
})
@Index('IDX_pull_request_ci_finding_bot', ['organizationId', 'recordedByBotId'], {
  where: '"recordedByBotId" IS NOT NULL',
})
@Check('CHK_pull_request_ci_finding_number', 'number > 0')
@Check(
  'CHK_pull_request_ci_finding_text',
  `char_length("check") > 0 AND char_length("rootCause") > 0 AND char_length("headSha") > 0`,
)
@Check('CHK_pull_request_ci_finding_relation', `relation IN (${sqlList(CI_FINDING_RELATIONS)})`)
@Check('CHK_pull_request_ci_finding_flake', `flake IN (${sqlList(CI_FINDING_FLAKE)})`)
@Check('CHK_pull_request_ci_finding_action', `action IN (${sqlList(CI_FINDING_ACTIONS)})`)
@Check(
  'CHK_pull_request_ci_finding_confidence',
  `confidence IN (${sqlList(CI_FINDING_CONFIDENCE)})`,
)
@Check('CHK_pull_request_ci_finding_evidence', `jsonb_typeof(evidence) = 'array'`)
export class CiFindingOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  /** GitHub's own id. A bigint, which the driver exchanges as a string. */
  @Column({ type: 'bigint' })
  githubRepoId!: string;

  @Column({ type: 'integer' })
  number!: number;

  @Column({ type: 'varchar', length: 64 })
  headSha!: string;

  @Column({ type: 'varchar', length: CI_FINDING_CHECK_MAX })
  check!: string;

  @Column({ type: 'varchar', length: CI_FINDING_ROOT_CAUSE_MAX })
  rootCause!: string;

  @Column({ type: 'varchar', length: 16 })
  relation!: string;

  @Column({ type: 'varchar', length: 8 })
  flake!: string;

  @Column({ type: 'varchar', length: 16 })
  action!: string;

  @Column({ type: 'varchar', length: CI_FINDING_NEXT_MAX })
  next!: string;

  @Column({ type: 'varchar', length: 8 })
  confidence!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidence!: string[];

  @Column({ type: 'uuid', nullable: true })
  recordedByUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  recordedByBotId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
