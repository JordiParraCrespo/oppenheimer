import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { MoreThan, type Repository } from 'typeorm';
import { Session } from '../../auth/database/session.orm-entity';
import type { OwnedSession, SessionReaderPort } from './session.repository.port';

/**
 * TypeORM-backed read adapter over Better Auth's `session` table, reading the
 * device sessions out of it.
 *
 * Expired rows are filtered out rather than shown as "expired": Better Auth
 * leaves them behind until they are cleaned up, and a device that can no longer
 * authenticate is not something a user needs to be offered a "sign out" button
 * for.
 *
 * Delegated rows are filtered out for a stronger reason: they are not devices
 * at all. `DelegatedSessionAdapter` mints one per API token or OAuth client so
 * the Better Auth façades can resolve their caller, and listing them as
 * signed-in devices turned two real sign-ins into 23 (issue #122). Both
 * methods exclude them, so an id that names one is "not found" to the revoke
 * command too — a credential is revoked where it is managed, not by signing
 * out a bridge it would rebuild on its next request.
 */
@Injectable()
export class SessionRepository implements SessionReaderPort {
  constructor(
    @InjectRepository(Session)
    private readonly repository: Repository<Session>,
  ) {}

  async findActiveByUserId(userId: string): Promise<OwnedSession[]> {
    const records = await this.repository.find({
      where: { userId, delegated: false, expiresAt: MoreThan(new Date()) },
      order: { updatedAt: 'DESC' },
    });
    return records.map(toOwnedSession);
  }

  async findOneById(sessionId: string): Promise<Option<OwnedSession>> {
    const record = await this.repository.findOneBy({ id: sessionId, delegated: false });
    return record ? Some(toOwnedSession(record)) : None;
  }
}

function toOwnedSession(record: Session): OwnedSession {
  return {
    id: record.id,
    userId: record.userId,
    token: record.token,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
  };
}
