import type { SessionState } from '@oppenheimer/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { SessionNameSource } from '../domain/session-state.policy';

/**
 * A session: one piece of work inside a project, and the fold of its own log.
 *
 * Three of the constraints here are not checks a handler could forget, because
 * they are not checks at all. `uq (organizationId, id)` exists so
 * `session_checkout` can reference a session **with its workspace in the key**,
 * and `uq (projectId, slug)` is a permanent tombstone: rows are never
 * hard-deleted, so a retired session's directory name and branch can never be
 * reissued. The `(organizationId, projectId)` composite foreign key in the
 * migration is what makes a session in another workspace's project
 * unrepresentable.
 *
 * `hostId` is the one reference a handler guards instead: a host belongs to a
 * person and carries no workspace column, and a grant is a row rather than a
 * column, so there is nothing for a composite key to reference. The create
 * command loads the host through the own-or-grant-scoped repository and refuses on
 * a miss (`product/versions/mvp/03-control-plane.md`).
 */
@Entity('work_session')
@Index('IDX_work_session_organization_state', ['organizationId', 'state', 'createdAt'])
@Index('IDX_work_session_project_state', ['projectId', 'state'])
@Index('IDX_work_session_host_state', ['hostId', 'state'])
@Unique('UQ_work_session_project_slug', ['projectId', 'slug'])
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
   * Where the agent is launched: inside that checkout, with the others as
   * siblings. Null starts it in the session directory with every checkout a peer.
   * A boolean on the checkout row could only express the first.
   */
  @Column({ type: 'uuid', nullable: true })
  cwdCheckoutId!: string | null;

  /**
   * The client's `Idempotency-Key`, so a retry after a lost response returns the
   * session already created rather than minting a second directory and a second
   * branch. Absent header, absent protection; the console always sends one.
   */
  @Column({ type: 'varchar', nullable: true })
  idempotencyKey!: string | null;

  /** The fold of the log, from here down. Never written except by that fold. */
  @Column({ type: 'varchar', default: 'starting' })
  state!: SessionState;

  /** Bumped on every state change, so a reader can order two folds. */
  @Column({ type: 'integer', default: 0 })
  stateSeq!: number;

  /** The agent's own session id, as the runner reported it. */
  @Column({ type: 'varchar', nullable: true })
  agentSessionId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastEventAt!: Date | null;

  /** When the agent and the tmux session last ended. The checkouts stay on disk. */
  @Column({ type: 'timestamp', nullable: true })
  stoppedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
