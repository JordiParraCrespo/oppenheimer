import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** A subject a trigger watches: a repository today. */
@Entity('automation_trigger_subject')
@Index('IDX_automation_trigger_subject_lookup', ['organizationId', 'subjectKind', 'subjectRef'])
export class AutomationTriggerSubjectOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  triggerId!: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  subjectKind!: string;

  @PrimaryColumn({ type: 'varchar', length: 128 })
  subjectRef!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;
}
