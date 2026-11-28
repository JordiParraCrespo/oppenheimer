import { Injectable } from '@nestjs/common';
import { type DomainEvent, OutboxService } from '@oppenheimer/backend-ddd';
import { OAuthAccessTokenOrmEntity } from './oauth-access-token.orm-entity';
import { OAuthConsentOrmEntity } from './oauth-consent.orm-entity';
import type { OAuthGrantRepositoryPort } from './oauth-grant.repository.port';

/**
 * Better Auth owns these tables and reads them on every OAuth request
 * (`getMcpSession` looks the access token up by value), so deleting the rows
 * is the revocation: nothing caches a grant in front of them.
 *
 * An authorization code is a `verification` row the MCP plugin wrote with the
 * code as `identifier` and a JSON `value` naming the `clientId` and `userId`
 * (`plugins/mcp/authorize`). Better Auth also mirrors it in Redis, but with
 * `verification.storeInDatabase` the exchange consumes the database row, so
 * deleting that row is what stops the code. Other verification rows (a reset
 * token's value is the bare user id) are not JSON, hence the guarded cast; the
 * table holds only short-lived rows, so the scan is small.
 */
@Injectable()
export class OAuthGrantRepository implements OAuthGrantRepositoryPort {
  constructor(private readonly outbox: OutboxService) {}

  async revokeAllForUser(
    userId: string,
    cutoff: Date,
    owed: readonly DomainEvent[],
  ): Promise<number> {
    return this.outbox.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO "credential_cutoff" ("userId", "issuedBefore") VALUES ($1, $2)
         ON CONFLICT ("userId") DO UPDATE
           SET "issuedBefore" = GREATEST("credential_cutoff"."issuedBefore", EXCLUDED."issuedBefore"),
               "updatedAt" = now()`,
        [userId, cutoff],
      );
      const tokens = await manager.getRepository(OAuthAccessTokenOrmEntity).delete({ userId });
      await manager.getRepository(OAuthConsentOrmEntity).delete({ userId });
      await manager.query(
        `DELETE FROM "verification"
          WHERE CASE WHEN pg_input_is_valid("value", 'jsonb')
                     THEN "value"::jsonb ->> 'userId' = $1 AND "value"::jsonb ? 'clientId'
                     ELSE false END`,
        [userId],
      );
      await this.outbox.stageEvents(manager, [...owed]);
      return tokens.affected ?? 0;
    });
  }
}
