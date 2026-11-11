import { randomUUID } from 'node:crypto';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { InboxReportOrmEntity } from '../database/inbox-report.orm-entity';
import { InboxReportRepository } from '../database/inbox-report.repository';
import { InboxReportEntity, type PostInboxReportProps } from '../domain/inbox-report.entity';
import { InboxReportMapper } from '../inbox-report.mapper';

/**
 * A workspace's Inbox reports against a real Postgres (`29-inbox.md`,
 * "Reports"): a report read back whole with its pictures, the list by
 * workspace and status with the newest first, one answer however many race,
 * the event each write stages, the table's own rules, and what a deleted
 * account and a deleted workspace leave. The schema is the migrations'.
 */
describe('inbox reports (integration)', () => {
  let dataSource: DataSource;
  let reports: InboxReportRepository;
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    const db = await useTestDatabase();
    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [InboxReportOrmEntity, OutboxMessageSchema],
      synchronize: false,
    });
    await dataSource.initialize();
    reports = new InboxReportRepository(
      dataSource.getRepository(InboxReportOrmEntity),
      new InboxReportMapper(),
      new OutboxService(dataSource),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  beforeEach(async () => {
    organizationId = await insertOrganization();
    userId = await insertUser();
  });

  async function insertOrganization(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [id, `acme-${id.slice(0, 8)}`],
    );
    return id;
  }

  async function insertUser(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [id, `${id}@example.com`],
    );
    return id;
  }

  function report(overrides: Partial<PostInboxReportProps> = {}): InboxReportEntity {
    return InboxReportEntity.post({
      organizationId,
      createdByUserId: userId,
      title: 'Checkout is down',
      body: 'Since 09:00',
      source: 'qa-explorer',
      link: 'https://example.com/runs/1',
      images: [],
      ...overrides,
    });
  }

  async function send(overrides: Partial<PostInboxReportProps> = {}, createdAt?: Date) {
    const sent = report(overrides);
    await reports.insert(sent);
    if (createdAt) {
      await dataSource.query(`UPDATE inbox_report SET "createdAt" = $1 WHERE id = $2`, [
        createdAt,
        sent.id,
      ]);
    }
    return sent;
  }

  async function staged(reportId: string): Promise<number> {
    const [{ count }]: { count: string }[] = await dataSource.query(
      `SELECT count(*) FROM outbox_message
       WHERE "eventName" = 'InboxReportChangedDomainEvent' AND payload->>'reportId' = $1
         AND payload->>'organizationId' = $2`,
      [reportId, organizationId],
    );
    return Number(count);
  }

  it('reads a report back whole, with its pictures and their keys, and stages its event', async () => {
    const sent = await send({
      images: [{ mimeType: 'image/png', sizeBytes: 12, name: 'shot.png', extension: 'png' }],
    });

    const stored = (await reports.findOne(organizationId, sent.id)).unwrap();
    expect(stored).toMatchObject({
      title: 'Checkout is down',
      body: 'Since 09:00',
      source: 'qa-explorer',
      link: 'https://example.com/runs/1',
      status: 'open',
      answer: null,
      createdByUserId: userId,
    });
    expect(stored.images).toEqual(sent.images);
    expect(await staged(sent.id)).toBe(1);
  });

  it("lists a workspace's reports in one status, the newest first, and no other workspace's", async () => {
    const older = await send({ title: 'older' }, new Date('2026-11-01T10:00:00Z'));
    const newer = await send({ title: 'newer' }, new Date('2026-11-02T10:00:00Z'));
    const answered = await send({ title: 'answered' });
    answered.answerWith('Fixed', userId, new Date());
    await reports.saveAnswer(answered);
    const elsewhere = await insertOrganization();
    const theirs = await send({ organizationId: elsewhere, title: 'theirs' });

    const open = await reports.findByStatus(organizationId, 'open', 100);
    expect(open.map((r) => r.id)).toEqual([newer.id, older.id]);
    expect((await reports.findByStatus(organizationId, 'answered', 100)).map((r) => r.id)).toEqual([
      answered.id,
    ]);
    expect(await reports.findByStatus(organizationId, 'open', 1)).toHaveLength(1);
    expect((await reports.findOne(organizationId, theirs.id)).isNone()).toBe(true);
  });

  it('keeps the first of two answers: the second writes nothing and stages nothing', async () => {
    const sent = await send();
    const first = (await reports.findOne(organizationId, sent.id)).unwrap();
    const second = (await reports.findOne(organizationId, sent.id)).unwrap();
    const at = new Date('2026-11-09T12:00:00Z');
    first.answerWith('Roll it back', userId, at);
    second.answerWith('Never mind', userId, new Date());

    expect(await reports.saveAnswer(first)).toBe(true);
    expect(await reports.saveAnswer(second)).toBe(false);

    const stored = (await reports.findOne(organizationId, sent.id)).unwrap();
    expect(stored).toMatchObject({
      status: 'answered',
      answer: 'Roll it back',
      answeredByUserId: userId,
      answeredAt: at,
    });
    expect(await staged(sent.id)).toBe(2);
  });

  it("does not answer another workspace's report", async () => {
    const sent = await send();
    const elsewhere = InboxReportEntity.create({
      id: sent.id,
      props: { ...sent.getProps(), organizationId: await insertOrganization() },
    });
    elsewhere.answerWith('Mine now', userId, new Date());
    expect(await reports.saveAnswer(elsewhere)).toBe(false);
    expect((await reports.findOne(organizationId, sent.id)).unwrap().status).toBe('open');
  });

  it('refuses what the table does not hold', async () => {
    const insert = (columns: Record<string, unknown>) => {
      const row = { organizationId, title: 'A report', ...columns };
      const names = Object.keys(row);
      return dataSource.query(
        `INSERT INTO inbox_report (${names.map((name) => `"${name}"`).join(', ')})
         VALUES (${names.map((_, index) => `$${index + 1}`).join(', ')})`,
        Object.values(row),
      );
    };
    const refused = (columns: Record<string, unknown>, constraint: string) =>
      expect(insert(columns)).rejects.toMatchObject({ constraint });

    await refused({ status: 'closed' }, 'CHK_inbox_report_status');
    await refused({ title: '' }, 'CHK_inbox_report_title');
    await refused({ body: 'x'.repeat(4001) }, 'CHK_inbox_report_body');
    await refused({ link: '' }, 'CHK_inbox_report_link');
    await refused({ images: JSON.stringify([1, 2, 3, 4, 5]) }, 'CHK_inbox_report_images');
    await refused({ images: JSON.stringify({}) }, 'CHK_inbox_report_images');
    await refused({ status: 'answered' }, 'CHK_inbox_report_answer');
    await refused({ answer: 'Fixed' }, 'CHK_inbox_report_answer');
    await refused({ status: 'answered', answer: 'Fixed' }, 'CHK_inbox_report_answer');
    await refused(
      { status: 'answered', answer: '', answeredAt: new Date() },
      'CHK_inbox_report_answer',
    );
    await expect(insert({})).resolves.toBeDefined();
  });

  it('outlives the accounts that sent and answered it, and goes with the workspace', async () => {
    const sent = await send();
    sent.answerWith('Fixed', userId, new Date());
    await reports.saveAnswer(sent);
    await dataSource.query(`DELETE FROM "user" WHERE id = $1`, [userId]);

    const kept = (await reports.findOne(organizationId, sent.id)).unwrap();
    expect(kept).toMatchObject({
      createdByUserId: null,
      answeredByUserId: null,
      answer: 'Fixed',
    });

    await dataSource.query(`DELETE FROM "organization" WHERE id = $1`, [organizationId]);
    expect((await reports.findOne(organizationId, sent.id)).isNone()).toBe(true);
  });
});
