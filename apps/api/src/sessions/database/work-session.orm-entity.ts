import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { SessionEffortDto, SessionPermissionDto, SessionState } from '@oppenheimer/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { AgentObservedState, SessionNameSource } from '../domain/session-state.policy';

/**
 * A session: one piece of work inside a project, and the fold of its own log.
 *
 * Three constraints are not checks a handler could forget. `uq (organizationId, id)`
 * lets `session_checkout` reference a session **with its workspace in the key**.
 * `uq (organizationId, slug)` is a permanent tombstone: rows are never hard-deleted,
 * so a retired session's directory name and branch are never reissued, and it is per
 * workspace because the directory is `workspaces/<org>/sessions/<slug>` (a project is
 * metadata; `projectId` is only where the session is listed). The migration's
 * `(organizationId, projectId)` composite foreign key makes a session in another
 * workspace's project unrepresentable.
 *
 * `hostId` is the one reference a handler guards instead: a host belongs to a person,
 * with no workspace column, and a grant is a row, so no composite key can reference
 * it. Create loads the host through the own-or-grant-scoped repository and refuses on
 * a miss (`product/versions/mvp/03-control-plane.md`).
 */
@Entity('work_session')
@Index('IDX_work_session_project_state', ['projectId', 'state'])
@Index('IDX_work_session_host_state', ['hostId', 'state'])
@Index('IDX_work_session_created_by', ['createdByUserId'])
@Unique('UQ_work_session_organization_slug', ['organizationId', 'slug'])
@Unique('UQ_work_session_organization_id', ['organizationId', 'id'])
export class WorkSessionOrmEntity {
  /**
   * Unguessable by construction, and also the tmux session name on the host, so
   * one id names the row and the thing it controls.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @Column({ type: 'uuid' })
  hostId!: string;

  /** Display name. Starts equal to the slug, then the first prompt names it. */
  @Column({ type: 'varchar' })
  name!: string;

  /**
   * Who last named the session. A title derived from the first prompt never
   * overwrites a name a person typed, and this column is how that survives a
   * restart of the process that decided it.
   */
  @Column({ type: 'varchar', nullable: true })
  nameSource!: SessionNameSource | null;

  /** `<adjective>-<noun>-<6 base36>`. A directory name, and immutable. */
  @Column({ type: 'varchar' })
  slug!: string;

  /** The coding agent, from the closed catalog in `@oppenheimer/shared`. */
  @Column({ type: 'varchar' })
  agent!: string;

  /**
   * The client's `Idempotency-Key`, so a retry after a lost response returns the
   * session already created rather than minting a second directory and a second
   * branch. Absent header, absent protection; the console always sends one.
   */
  @Column({ type: 'varchar', nullable: true })
  idempotencyKey!: string | null;

  /**
   * The fold of the log, from here down. Never written except by that fold.
   *
   * The block is longer than the lifecycle because the **derived group** is a
   * function of the row: a sidebar cannot walk a log per listing row, so what the
   * agent was last observed doing, when it entered that state, and the two report
   * hashes are columns the fold projects exactly as it projects `state`.
   */
  @Column({ type: 'varchar', default: 'starting' })
  state!: SessionState;

  /** Bumped on every state change, so a reader can order two folds. */
  @Column({ type: 'integer', default: 0 })
  stateSeq!: number;

  @Column({ type: 'varchar', nullable: true })
  agentSessionId!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  lastEventAt!: Date | null;

  /** When the agent and the tmux session last ended. The checkouts stay on disk. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  stoppedAt!: Date | null;

  /**
   * Where the agent is launched: inside that checkout, with the others as
   * siblings. Null starts it in the session directory with every checkout a peer.
   * A boolean on the checkout row could only express the first.
   */
  @Column({ type: 'uuid', nullable: true })
  cwdCheckoutId!: string | null;

  /** What the screen manifest last reported. An input to the group, never a state. */
  @Column({ type: 'varchar', nullable: true })
  lastObservedState!: AgentObservedState | null;

  /**
   * When the transition **into** that state was recorded. Null after a single
   * report, which is what makes the group's debounce unfakeable: one sighting is
   * not evidence of having been stuck.
   */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  observedSince!: Date | null;

  /**
   * The model, permission level and effort the composer's foot row launched with.
   * Three columns, not one JSON value, because each is a closed union, which a
   * `varchar` column is for (`.agents/rules/typeorm.md`). They are folded from
   * `session.requested`, and exist because a restart must reproduce the launch and
   * the console shows it (`product/versions/mvp/03-control-plane.md`).
   */
  @Column({ type: 'varchar', nullable: true })
  launchModel!: string | null;

  /**
   * Null only for an agent with no approvals (the blank terminal). Every other
   * session was launched at some level, and `ask` is the absent one.
   */
  @Column({ type: 'varchar', nullable: true, default: 'ask' })
  launchPermission!: SessionPermissionDto | null;

  /** Null leaves the agent its own default. */
  @Column({ type: 'varchar', nullable: true })
  launchEffort!: SessionEffortDto | null;

  @Column({ type: 'varchar', nullable: true })
  reportHash!: string | null;

  @Column({ type: 'varchar', nullable: true })
  ackedReportHash!: string | null;

  /** Who asked for the session: `person`, or `automation` (whose run points back here). */
  @Column({ type: 'varchar', length: 16, default: 'person' })
  origin!: 'person' | 'automation';

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
