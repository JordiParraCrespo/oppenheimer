import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { None, type Option, Some } from 'oxide.ts';
import { MoreThan, type Repository } from 'typeorm';
import { Session } from '../../auth/database/session.orm-entity';
import type { OwnedSession, SessionReaderPort } from './session.repository.port';

/**
 * Expired rows are filtered out: Better Auth leaves them until cleanup, and a
 * device that can no longer authenticate needs no "sign out" button.
 *
 * Delegated rows are filtered out because they are not devices: listing
 * `DelegatedSessionAdapter`'s bridges turned two real sign-ins into 23 (issue
 * #122). Both methods exclude them, so the revoke command finds such an id
 * "not found": a credential is revoked where it is managed, not by signing out
 * a bridge it would rebuild on its next request.
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
