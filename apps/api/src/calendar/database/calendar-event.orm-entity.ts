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
 * A personal event on Plan's calendar (`product/versions/mvp/20-plan-calendar.md` §2).
 * Wall-clock like a task's due date: a day, and a start and an end on it. The times'
 * rules are the database's, so an event that ends before it starts cannot be stored.
 */
@Entity('calendar_event')
@Index('IDX_calendar_event_date', ['organizationId', 'date'])
@Index('IDX_calendar_event_created_by', ['createdByUserId'], {
  where: '"createdByUserId" IS NOT NULL',
})
@Check(
  'CHK_calendar_event_time_format',
  `("startTime" IS NULL OR "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND ("endTime" IS NULL OR "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')`,
)
@Check(
  'CHK_calendar_event_times',
  `("allDay" AND "startTime" IS NULL AND "endTime" IS NULL) OR (NOT "allDay" AND "startTime" IS NOT NULL AND "endTime" IS NOT NULL AND "endTime" > "startTime")`,
)
export class CalendarEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'boolean', default: false })
  allDay!: boolean;

  @Column({ type: 'varchar', length: 5, nullable: true })
  startTime!: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  endTime!: string | null;

  @Column({ type: 'boolean', default: true })
  busy!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
