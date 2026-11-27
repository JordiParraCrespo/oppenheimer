import { Injectable } from '@nestjs/common';
import { type DomainEvent, OutboxService } from '@oppenheimer/backend-ddd';
import { OAuthAccessTokenOrmEntity } from './oauth-access-token.orm-entity';
import { OAuthConsentOrmEntity } from './oauth-consent.orm-entity';
import type { OAuthGrantRepositoryPort } from './oauth-grant.repository.port';

/**
 * Better Auth owns these tables and reads them on every OAuth request
 * (`getMcpSession` looks the access token up by value), so deleting the rows
 * is the revocation: nothing caches a grant in front of them.
 */
@Injectable()
export class OAuthGrantRepository implements OAuthGrantRepositoryPort {
  constructor(private readonly outbox: OutboxService) {}

  async revokeAllForUser(userId: string, owed: readonly DomainEvent[]): Promise<number> {
    return this.outbox.transaction(async (manager) => {
      const tokens = await manager.getRepository(OAuthAccessTokenOrmEntity).delete({ userId });
      await manager.getRepository(OAuthConsentOrmEntity).delete({ userId });
      await this.outbox.stageEvents(manager, [...owed]);
      return tokens.affected ?? 0;
    });
  }
}
