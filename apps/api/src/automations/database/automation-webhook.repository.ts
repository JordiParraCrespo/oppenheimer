import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AutomationWebhookOrmEntity } from './automation-webhook.orm-entity';
import type {
  AutomationWebhookRepositoryPort,
  IssuedRoutineWebhook,
  RoutineWebhookRecord,
  RoutineWebhookView,
} from './automation-webhook.repository.port';

@Injectable()
export class AutomationWebhookRepository implements AutomationWebhookRepositoryPort {
  constructor(
    @InjectRepository(AutomationWebhookOrmEntity)
    private readonly repository: Repository<AutomationWebhookOrmEntity>,
  ) {}

  async issue(webhook: IssuedRoutineWebhook): Promise<RoutineWebhookView> {
    // A new URL is a new row: issued now, never received.
    const [row]: AutomationWebhookOrmEntity[] = await this.repository.query(
      `INSERT INTO automation_webhook
         ("organizationId", "automationId", "tokenHash", "tokenPrefix", "signingSecretSealed",
          "issuedVerified")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("organizationId", "automationId") DO UPDATE SET
         "tokenHash" = EXCLUDED."tokenHash",
         "tokenPrefix" = EXCLUDED."tokenPrefix",
         "signingSecretSealed" = EXCLUDED."signingSecretSealed",
         "issuedVerified" = EXCLUDED."issuedVerified",
         "lastReceivedAt" = NULL,
         "createdAt" = now(),
         "updatedAt" = now()
       RETURNING *`,
      [
        webhook.organizationId,
        webhook.automationId,
        webhook.tokenHash,
        webhook.tokenPrefix,
        webhook.signingSecretSealed,
        webhook.issuedVerified,
      ],
    );
    return viewOf(row);
  }

  async revoke(organizationId: string, automationId: string): Promise<void> {
    await this.repository.delete({ organizationId, automationId });
  }

  async revokeIssuedUnverified(
    organizationIds: readonly string[],
    issuedUpTo: Date,
  ): Promise<number> {
    if (organizationIds.length === 0) return 0;
    // A re-issue rewrites "createdAt", so it is the moment this URL was issued.
    const [, affected] = (await this.repository.query(
      `DELETE FROM automation_webhook
        WHERE "organizationId" = ANY($1::uuid[])
          AND "issuedVerified" = false
          AND "createdAt" <= $2`,
      [[...organizationIds], issuedUpTo],
    )) as [unknown[], number];
    return affected;
  }

  async findByTokenHash(tokenHash: string): Promise<RoutineWebhookRecord | null> {
    const row = await this.repository.findOneBy({ tokenHash });
    return row
      ? {
          ...viewOf(row),
          organizationId: row.organizationId,
          signingSecretSealed: row.signingSecretSealed,
        }
      : null;
  }

  async findViews(
    organizationId: string,
    automationIds: readonly string[],
  ): Promise<Map<string, RoutineWebhookView>> {
    if (automationIds.length === 0) return new Map();
    const rows = await this.repository.findBy({
      organizationId,
      automationId: In([...automationIds]),
    });
    return new Map(rows.map((row) => [row.automationId, viewOf(row)]));
  }

  async markReceived(organizationId: string, automationId: string, at: Date): Promise<void> {
    await this.repository.update({ organizationId, automationId }, { lastReceivedAt: at });
  }
}

function viewOf(row: AutomationWebhookOrmEntity): RoutineWebhookView {
  return {
    automationId: row.automationId,
    tokenPrefix: row.tokenPrefix,
    signed: row.signingSecretSealed !== null,
    issuedAt: new Date(row.createdAt),
    lastReceivedAt: row.lastReceivedAt ? new Date(row.lastReceivedAt) : null,
  };
}
