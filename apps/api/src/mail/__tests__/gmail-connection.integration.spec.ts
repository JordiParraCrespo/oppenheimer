import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { GmailConnectionOrmEntity } from '../database/gmail-connection.orm-entity';
import { GmailConnectionRepository } from '../database/gmail-connection.repository';
import { GmailConnectionMapper } from '../gmail-connection.mapper';

/**
 * The poll's history marks against a real Postgres, through the repository
 * the poll uses: the marks of the accounts the poll did not read are dropped,
 * so an account watched again after a pause, a deleted routine or a revoked
 * grant starts from now; and a poll that read with a mark since dropped
 * moves nothing. The poll's decisions over a double are
 * `poll-watched-mail.command-handler.spec.ts`.
 */
describe('Gmail connection history marks (integration)', () => {
  let dataSource: DataSource;
  let connections: GmailConnectionRepository;
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    const db = await useTestDatabase();
    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [GmailConnectionOrmEntity],
    });
    await dataSource.initialize();
    connections = new GmailConnectionRepository(
      dataSource.getRepository(GmailConnectionOrmEntity),
      new GmailConnectionMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  beforeEach(async () => {
    organizationId = randomUUID();
    userId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [userId, `${userId}@example.com`],
    );
  });

  async function insertConnection(historyId: string | null): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "gmail_connection"
         ("id", "organizationId", "userId", "googleSubject", "accountEmail", "label",
          "refreshTokenSealed", "historyId")
       VALUES ($1, $2, $3, $4, 'ana@gmail.test', 'Personal', '\\x00', $5)`,
      [id, organizationId, userId, `sub-${id}`, historyId],
    );
    return id;
  }

  async function markOf(id: string): Promise<string | null> {
    const [row]: { historyId: string | null }[] = await dataSource.query(
      `SELECT "historyId" FROM "gmail_connection" WHERE "id" = $1`,
      [id],
    );
    return row.historyId;
  }

  it('drops the mark of every account the poll did not read, and keeps the rest', async () => {
    const read = await insertConnection('100');
    const unwatched = await insertConnection('200');
    const fresh = await insertConnection(null);

    const dropped = await connections.forgetHistoryExcept([read]);

    expect(dropped).toBeGreaterThanOrEqual(1);
    expect(await markOf(read)).toBe('100');
    expect(await markOf(unwatched)).toBeNull();
    expect(await markOf(fresh)).toBeNull();
  });

  it('drops every mark when the poll read nothing', async () => {
    const id = await insertConnection('300');

    await connections.forgetHistoryExcept([]);

    expect(await markOf(id)).toBeNull();
  });

  // What breaks this: a poll that read with the old mark putting it back
  // after the mark was dropped, so the gap's mail would wake routines later.
  it('moves no mark that was dropped since the poll read it', async () => {
    const id = await insertConnection('400');
    const [loaded] = await connections.findManyForSystem([id]);

    await connections.forgetHistoryExcept([]);

    await expect(connections.markHistory(loaded, '500')).resolves.toBe(false);
    expect(await markOf(id)).toBeNull();
  });
});
