import type { EntityManager } from 'typeorm';
import type { SessionCloudRunEntity } from '../domain/session-cloud-run.entity';
import type { WorkSessionMapper } from '../work-session.mapper';
import { SessionCloudRunOrmEntity } from './session-cloud-run.orm-entity';
import type { WorkSessionOrmEntity } from './work-session.orm-entity';

/**
 * The `session_cloud_run` table, for `WorkSessionRepository` alone: a cloud
 * session's vendor half is a member of the session aggregate, inserted with
 * the session and loaded with it.
 */
export class SessionCloudRunRepository {
  constructor(
    private readonly manager: EntityManager,
    private readonly mapper: WorkSessionMapper,
  ) {}

  async insert(manager: EntityManager, run: SessionCloudRunEntity): Promise<void> {
    await manager
      .getRepository(SessionCloudRunOrmEntity)
      .insert(this.mapper.cloudRunToPersistence(run));
  }

  /** Written only while the row is still on the run it was read with; true when it was. */
  async saveIf(run: SessionCloudRunEntity, runIdAtLoad: string): Promise<boolean> {
    const { sessionId, organizationId, ...changes } = this.mapper.cloudRunToPersistence(run);
    const result = await this.manager
      .getRepository(SessionCloudRunOrmEntity)
      .update({ sessionId, organizationId, latestRunId: runIdAtLoad }, changes);
    return result.affected === 1;
  }

  /**
   * The cloud runs of a page's sessions launched at a vendor, by the primary
   * key; no query for none. Only those have a run: no host started them.
   */
  async findForSessions(
    records: WorkSessionOrmEntity[],
  ): Promise<Map<string, SessionCloudRunOrmEntity>> {
    const sessionIds = records
      .filter((record) => record.place === 'cloud' && record.hostId === null)
      .map((r) => r.id);
    if (sessionIds.length === 0) return new Map();
    const runs = await this.manager
      .getRepository(SessionCloudRunOrmEntity)
      .createQueryBuilder('run')
      .where('run.sessionId IN (:...sessionIds)', { sessionIds })
      .getMany();
    return new Map(runs.map((run) => [run.sessionId, run]));
  }
}
