import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { MailPlan } from '@oppenheimer/shared';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { GmailConnectionOrmEntity } from '../database/gmail-connection.orm-entity';
import { GmailConnectionRepository } from '../database/gmail-connection.repository';
import { MailSendOrmEntity } from '../database/mail-send.orm-entity';
import { MailSendRepository } from '../database/mail-send.repository';
import { GmailConnectionEntity } from '../domain/gmail-connection.entity';
import { MailSendEntity } from '../domain/mail-send.entity';
import { GmailConnectionMapper } from '../gmail-connection.mapper';
import { MailSendMapper } from '../mail-send.mapper';

/**
 * Mail's one table against a real Postgres, built by the migrations: a Gmail
 * connection is read only by its owner, even by a workspace owner who can
 * read every row of the workspace; one Google account is one row per person;
 * and the connection goes with the person. A send is claimed once per
 * approval, two racing claims see one winner, and the daily count takes what
 * went and what is going but not what failed; the record outlives the
 * account it went from.
 */
describe('mail (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let connections: GmailConnectionRepository;
  let sends: MailSendRepository;
  let organizationId: string;
  let ana: string;
  let ben: string;

  const scopeOf = (user: string, bypass = false): AccessScope => ({
    userId: user,
    organizationId,
    teamIds: [],
    grants: new Map(),
    bypass,
  });

  beforeAll(async () => {
    pg = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    process.env.DB_HOST = pg.getHost();
    process.env.DB_PORT = pg.getMappedPort(5432).toString();
    await runAllMigrations();
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
      entities: [GmailConnectionOrmEntity, MailSendOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    connections = new GmailConnectionRepository(
      dataSource.getRepository(GmailConnectionOrmEntity),
      new GmailConnectionMapper(),
    );
    sends = new MailSendRepository(
      dataSource.getRepository(MailSendOrmEntity),
      new MailSendMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pg?.stop();
  });

  async function insertUser(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName") VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [id, `${id}@example.com`],
    );
    return id;
  }

  beforeEach(async () => {
    organizationId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    ana = await insertUser();
    ben = await insertUser();
  });

  const connection = (userId: string, googleSubject = 'sub-1') =>
    GmailConnectionEntity.connect({
      organizationId,
      userId,
      googleSubject,
      accountEmail: 'ana@gmail.test',
      label: 'Personal',
      refreshTokenSealed: Buffer.from('sealed'),
      scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    });

  it('reads a connection only for its owner, a workspace-wide reader included', async () => {
    const mine = connection(ana);
    await connections.insert(mine);

    await expect(connections.findAllOwn(scopeOf(ana))).resolves.toHaveLength(1);
    await expect(connections.findAllOwn(scopeOf(ben, true))).resolves.toEqual([]);
    expect((await connections.findOwnById(scopeOf(ben, true), mine.id)).isNone()).toBe(true);
  });

  it('keeps one row per Google account per person, and lets another person hold the same account', async () => {
    await connections.insert(connection(ana));

    await expect(connections.insert(connection(ana))).rejects.toThrow(
      /UQ_gmail_connection_user_account/,
    );
    await expect(connections.insert(connection(ben))).resolves.toBeUndefined();
  });

  it('writes a rename and a revoke, and the grant goes with the person', async () => {
    const mine = connection(ana);
    await connections.insert(mine);
    mine.rename('Work');
    await connections.save(mine);
    await connections.markRevoked(mine);

    const [read] = await connections.findAllOwn(scopeOf(ana));
    expect(read).toMatchObject({ label: 'Work', status: 'revoked' });

    await dataSource.query(`DELETE FROM "user" WHERE id = $1`, [ana]);
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM gmail_connection WHERE "userId" = $1`,
      [ana],
    );
    expect(count).toBe(0);
  });

  const PLAN = (connectionId: string): MailPlan => ({
    kind: 'new',
    connectionId,
    accountEmail: 'ana@gmail.test',
    from: { email: 'ana@gmail.test', name: null },
    to: ['bo@client.test'],
    cc: [],
    bcc: [],
    recipientsFromMail: false,
    subject: 'Invoice 42',
    body: 'Paid',
    signature: true,
    original: null,
    threadId: null,
    attachments: [],
    draftId: null,
    draftMessageId: null,
  });

  const claimOf = (connectionId: string, approvalId = randomUUID()) =>
    MailSendEntity.claim({
      organizationId,
      userId: ana,
      connectionId,
      botId: null,
      approvalId,
      kind: 'new',
      accountEmail: 'ana@gmail.test',
      recipients: ['bo@client.test'],
      subject: 'Invoice 42',
    });

  it('claims a send once per approval, with one winner when two claims race', async () => {
    const account = connection(ana);
    await connections.insert(account);
    const approvalId = randomUUID();

    const raced = await Promise.all([
      sends.claim(claimOf(account.id, approvalId)),
      sends.claim(claimOf(account.id, approvalId)),
    ]);

    expect(raced.filter(Boolean)).toHaveLength(1);
    const stored = (await sends.findByApproval(approvalId)).unwrap();
    expect(stored.status).toBe('sending');
  });

  it('counts what went and what is going in the day, not what failed, and keeps the record when the account goes', async () => {
    const account = connection(ana);
    await connections.insert(account);
    const [sent, failed, going] = [claimOf(account.id), claimOf(account.id), claimOf(account.id)];
    for (const send of [sent, failed, going]) await sends.claim(send);
    sent.sent('g1', 't1', new Date());
    failed.failed(new Date());
    await sends.save(sent);
    await sends.save(failed);

    await expect(sends.countSince(account.id, new Date(Date.now() - 60_000))).resolves.toBe(2);
    await expect(sends.countSince(account.id, new Date(Date.now() + 60_000))).resolves.toBe(0);

    await dataSource.query(`DELETE FROM gmail_connection WHERE id = $1`, [account.id]);
    const own = await sends.findRecentOwn(scopeOf(ana), 10);
    expect(own).toHaveLength(3);
    expect(own.find((send) => send.id === sent.id)).toMatchObject({
      connectionId: null,
      status: 'sent',
      gmailMessageId: 'g1',
    });
    await expect(sends.findRecentOwn(scopeOf(ben, true), 10)).resolves.toEqual([]);
  });

  it('finds a due send, lets one of a claim and a cancel win, and keeps the plan only while it waits', async () => {
    const account = connection(ana);
    await connections.insert(account);
    const due = MailSendEntity.schedule(
      {
        organizationId,
        userId: ana,
        connectionId: account.id,
        botId: null,
        approvalId: randomUUID(),
        kind: 'new',
        accountEmail: 'ana@gmail.test',
        recipients: ['bo@client.test'],
        subject: 'Invoice 42',
      },
      PLAN(account.id),
      new Date(Date.now() - 60_000),
    );
    await sends.claim(due);

    const found = (await sends.findDue(new Date(), 10)).filter((send) => send.id === due.id);
    expect(found).toHaveLength(1);
    expect(found[0].plan).toMatchObject({ subject: 'Invoice 42' });
    await expect(sends.findScheduledOwn(scopeOf(ana), 10)).resolves.toHaveLength(1);

    const [claimed, cancelled] = await Promise.all([
      sends.claimDue(due),
      sends.cancelOwn(scopeOf(ana), due.id),
    ]);
    expect([claimed, cancelled].filter(Boolean)).toHaveLength(1);
    await expect(sends.findScheduledOwn(scopeOf(ana), 10)).resolves.toEqual([]);
    await expect(sends.cancelOwn(scopeOf(ben), due.id)).resolves.toBe(false);
  });

  it('refuses a scheduled row without its time or its plan', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO mail_send ("organizationId", "userId", "approvalId", kind, "accountEmail", subject, status)
         VALUES ($1, $2, $3, 'new', 'ana@gmail.test', 'x', 'scheduled')`,
        [organizationId, ana, randomUUID()],
      ),
    ).rejects.toThrow(/CHK_mail_send_scheduled/);
  });

  it('lets only one of two sends approved at once take the last place under the day’s cap', async () => {
    const account = connection(ana);
    await connections.insert(account);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (let i = 0; i < 2; i += 1) await sends.claim(claimOf(account.id));

    const raced = await Promise.all([
      sends.claimUnderCap(claimOf(account.id), since, 3),
      sends.claimUnderCap(claimOf(account.id), since, 3),
    ]);

    expect(raced.map((claim) => claim.outcome).sort()).toEqual(['claimed', 'over_cap']);
    await expect(sends.countSince(account.id, since)).resolves.toBe(3);
  });
});
