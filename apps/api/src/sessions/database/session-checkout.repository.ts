import type { EntityManager } from 'typeorm';
import type { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import type { WorkSessionMapper } from '../work-session.mapper';
import { SessionCheckoutOrmEntity } from './session-checkout.orm-entity';

/**
 * The `session_checkout` table, for `WorkSessionRepository` alone. A checkout is
 * a member of the session aggregate, so nothing outside the session's own
 * adapter reaches it: every write here runs inside a transaction that adapter
 * opened, and every read is part of loading a session.
 */
export class SessionCheckoutRepository {
  constructor(
    private readonly manager: EntityManager,
    private readonly mapper: WorkSessionMapper,
  ) {}

  async insert(manager: EntityManager, checkout: SessionCheckoutEntity): Promise<void> {
    await manager
      .getRepository(SessionCheckoutOrmEntity)
      .insert(this.mapper.checkoutToPersistence(checkout));
  }

  async retire(manager: EntityManager, checkout: SessionCheckoutEntity): Promise<void> {
    await manager
      .getRepository(SessionCheckoutOrmEntity)
      .update({ id: checkout.id }, { removedAt: checkout.removedAt ?? new Date() });
  }

  /** One session's checkouts, oldest first, on the caller's transaction. */
  findForSession(manager: EntityManager, sessionId: string): Promise<SessionCheckoutOrmEntity[]> {
    return manager.getRepository(SessionCheckoutOrmEntity).find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Checkouts for a page of sessions, in one query rather than one per row. */
  async findForSessions(sessionIds: string[]): Promise<Map<string, SessionCheckoutOrmEntity[]>> {
    const byId = new Map<string, SessionCheckoutOrmEntity[]>();
    if (sessionIds.length === 0) return byId;
    const records = await this.manager
      .getRepository(SessionCheckoutOrmEntity)
      .createQueryBuilder('checkout')
      .where('checkout.sessionId IN (:...sessionIds)', { sessionIds })
      .orderBy('checkout.createdAt', 'ASC')
      .getMany();
    for (const record of records) {
      const existing = byId.get(record.sessionId);
      if (existing) existing.push(record);
      else byId.set(record.sessionId, [record]);
    }
    return byId;
  }

  async deleteForOrganization(manager: EntityManager, organizationId: string): Promise<void> {
    await manager.delete(SessionCheckoutOrmEntity, { organizationId });
  }
}
