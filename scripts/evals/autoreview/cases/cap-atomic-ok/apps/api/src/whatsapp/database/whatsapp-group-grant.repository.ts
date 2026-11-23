import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  WhatsappGroupGrant,
  WhatsappGroupGrantRepositoryPort,
} from './whatsapp-group-grant.repository.port';

@Injectable()
export class WhatsappGroupGrantRepository implements WhatsappGroupGrantRepositoryPort {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async insertUnderCap(grant: WhatsappGroupGrant, cap: number): Promise<boolean> {
    return this.db.transaction(async (manager) => {
      // Serialize every allow for this account, then count and insert under the lock.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [grant.accountId]);
      const rows: Array<{ inserted: boolean }> = await manager.query(
        `INSERT INTO whatsapp_group_grants (account_id, group_jid, bot_id)
         SELECT $1, $2, $3
         WHERE (SELECT count(*) FROM whatsapp_group_grants WHERE account_id = $1) < $4
         ON CONFLICT (account_id, group_jid) DO NOTHING
         RETURNING true AS inserted`,
        [grant.accountId, grant.groupJid, grant.botId, cap],
      );
      return rows.length === 1;
    });
  }
}
