import { createHash } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots (`product/versions/mvp/25-bots.md` §5): a Needs input card approves
 * one exact call, and only for a while.
 *
 * - `callDigest`: sha256 of the card's id, tool and input as JSON with every
 *   object's keys sorted (`approvalCallDigest`). A yes must name it, so a
 *   person approves the call they were shown and no other, and a digest from
 *   one card never approves another; the job that runs the call checks it
 *   against the stored input again before running. Set once with the card.
 * - `expiresAt`: past it a pending card can no longer be decided and is
 *   moved to `expired` the next time anyone looks (a decision, or the bot
 *   asking again). Each tool picks its own window; the default is a day.
 *
 * Existing rows are backfilled: the digest computed here from what each row
 * stores (a frozen copy of the app's rule, so this migration never changes
 * with the code), and the default day from `createdAt`. A pending card older
 * than a day therefore expires at its next look.
 *
 * No new index: the pending card is read through `UQ_bot_approval_pending`,
 * and expiry is checked on that row, never swept.
 */
export class BindBotApprovals1791002600000 implements MigrationInterface {
  name = 'BindBotApprovals1791002600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bot_approval ADD COLUMN "callDigest" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_approval ADD COLUMN "expiresAt" timestamp with time zone`,
    );
    const rows: { id: string; tool: string; input: Record<string, unknown> }[] =
      await queryRunner.query(`SELECT id, "tool", "input" FROM bot_approval`);
    for (const row of rows) {
      await queryRunner.query(`UPDATE bot_approval SET "callDigest" = $2 WHERE id = $1`, [
        row.id,
        digestOf(row.id, row.tool, row.input ?? {}),
      ]);
    }
    await queryRunner.query(
      `UPDATE bot_approval SET "expiresAt" = "createdAt" + interval '24 hours'`,
    );
    await queryRunner.query(`ALTER TABLE bot_approval ALTER COLUMN "callDigest" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE bot_approval ALTER COLUMN "expiresAt" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE bot_approval ADD CONSTRAINT "CHK_bot_approval_call_digest" CHECK ("callDigest" ~ '^[0-9a-f]{64}$')`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_approval ADD CONSTRAINT "CHK_bot_approval_expires" CHECK ("expiresAt" > "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_approval DROP CONSTRAINT "CHK_bot_approval_expires"`);
    await queryRunner.query(
      `ALTER TABLE bot_approval DROP CONSTRAINT "CHK_bot_approval_call_digest"`,
    );
    await queryRunner.query(`ALTER TABLE bot_approval DROP COLUMN "expiresAt"`);
    await queryRunner.query(`ALTER TABLE bot_approval DROP COLUMN "callDigest"`);
  }
}

function digestOf(id: string, tool: string, input: Record<string, unknown>): string {
  return createHash('sha256').update(canonical({ id, tool, input })).digest('hex');
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
