import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every point in time becomes `timestamptz` (#61).
 *
 * `timestamp without time zone` was TypeORM's default, so it was what every
 * date column got unless it said otherwise, and only six did. A value in such a
 * column goes out with no offset, the browser reads it as local time, and the
 * console was out by the reader's offset everywhere: a session created seconds
 * ago read two hours old in CEST.
 *
 * The values do not move. What is stored is already UTC (`now()` in a UTC
 * session, and the API runs in UTC), and `AT TIME ZONE 'UTC'` says so rather
 * than shifting anything: it reads each wall-clock value as the UTC instant it
 * always was. `down` states the same thing the other way round.
 *
 * The list is the schema as the migrations before this one leave it, every
 * `timestamp without time zone` column and no other. One `ALTER TABLE` per
 * table, so each table is rewritten once. New columns cannot repeat this: the
 * entities declare dates through `TimestampColumn`, `CreatedAtColumn` and
 * `UpdatedAtColumn` from `@oppenheimer/backend-ddd`, which fix the type, and
 * `pnpm check:api-structure` fails an entity that does not.
 */
const COLUMNS: ReadonlyArray<readonly [table: string, columns: readonly string[]]> = [
  ['access_grant', ['createdAt']],
  ['account', ['accessTokenExpiresAt', 'createdAt', 'refreshTokenExpiresAt', 'updatedAt']],
  ['api_token', ['createdAt', 'expiresAt', 'lastUsedAt', 'revokedAt', 'updatedAt']],
  ['billing_customer', ['createdAt', 'updatedAt']],
  ['github_installation', ['createdAt', 'deletedAt', 'suspendedAt', 'updatedAt']],
  ['host', ['createdAt', 'updatedAt']],
  ['host_pairing_token', ['createdAt', 'updatedAt']],
  ['invitation', ['createdAt', 'expiresAt']],
  ['lead', ['createdAt', 'updatedAt']],
  ['member', ['createdAt']],
  ['oauthAccessToken', ['accessTokenExpiresAt', 'createdAt', 'refreshTokenExpiresAt', 'updatedAt']],
  ['oauthApplication', ['createdAt', 'updatedAt']],
  ['oauthConsent', ['createdAt', 'updatedAt']],
  ['organization', ['createdAt']],
  ['outbox_message', ['availableAt', 'createdAt', 'lockedUntil', 'processedAt']],
  ['project', ['archivedAt', 'createdAt', 'updatedAt']],
  ['role', ['createdAt', 'updatedAt']],
  ['session', ['createdAt', 'expiresAt', 'updatedAt']],
  ['session_checkout', ['createdAt', 'pushedAt', 'removedAt', 'worktreeCreatedAt']],
  ['subscription', ['canceledAt', 'createdAt', 'currentPeriodEnd', 'lastEventAt', 'updatedAt']],
  ['team', ['createdAt', 'updatedAt']],
  ['teamMember', ['createdAt']],
  ['user', ['banExpires', 'createdAt', 'updatedAt']],
  ['user_role', ['createdAt']],
  ['user_settings', ['createdAt', 'updatedAt']],
  ['verification', ['createdAt', 'expiresAt', 'updatedAt']],
  ['work_session', ['createdAt', 'lastEventAt', 'observedSince', 'stoppedAt', 'updatedAt']],
  ['work_session_event', ['occurredAt', 'recordedAt']],
];

function alter(type: 'timestamptz' | 'timestamp'): string[] {
  return COLUMNS.map(
    ([table, columns]) =>
      `ALTER TABLE "${table}" ${columns
        .map(
          (column) => `ALTER COLUMN "${column}" TYPE ${type} USING "${column}" AT TIME ZONE 'UTC'`,
        )
        .join(', ')}`,
  );
}

export class StoreTimestampsWithTimeZone1789300000000 implements MigrationInterface {
  name = 'StoreTimestampsWithTimeZone1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const statement of alter('timestamptz')) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const statement of alter('timestamp')) await queryRunner.query(statement);
  }
}
