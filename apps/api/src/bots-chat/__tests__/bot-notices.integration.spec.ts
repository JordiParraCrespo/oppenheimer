import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { BotMapper } from '../../bots/bot.mapper';
import { BotDocumentMapper } from '../../bots/bot-document.mapper';
import { BotOrmEntity } from '../../bots/database/bot.orm-entity';
import { BotRepository } from '../../bots/database/bot.repository';
import { BotDocumentOrmEntity } from '../../bots/database/bot-document.orm-entity';
import { BotDocumentRevisionOrmEntity } from '../../bots/database/bot-document-revision.orm-entity';
import { BotEntity } from '../../bots/domain/bot.entity';
import { userActor } from '../../bots/domain/bot.types';
import { BotDocumentEntity } from '../../bots/domain/bot-document.entity';
import { BotNoticeMapper } from '../bot-notice.mapper';
import { BotNoticeOrmEntity } from '../database/bot-notice.orm-entity';
import { BotNoticeRepository } from '../database/bot-notice.repository';
import { BotNoticeEntity } from '../domain/bot-notice.entity';

/**
 * A bot's notices against a real Postgres (`agent-tools.md` §5): one row per
 * bot, each new notice taking it under a new id (the Inbox keys an item by
 * that id, so a mark on the last never hides the next), its event staged with
 * it, the workspace read newest first and only the caller's workspace's, and
 * the row gone with the bot.
 */
describe('bot notices (integration)', () => {
  let dataSource: DataSource;
  let bots: BotRepository;
  let notices: BotNoticeRepository;
  let organizationId: string;
  let userId: string;

  const scopeOf = (organization: string): AccessScope => ({
    userId,
    organizationId: organization,
    teamIds: [],
    grants: new Map(),
    bypass: false,
  });

  beforeAll(async () => {
    const db = await useTestDatabase();
    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [
        BotOrmEntity,
        BotDocumentOrmEntity,
        BotDocumentRevisionOrmEntity,
        BotNoticeOrmEntity,
        OutboxMessageSchema,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    bots = new BotRepository(
      dataSource.getRepository(BotOrmEntity),
      new BotMapper(),
      new BotDocumentMapper(),
      new OutboxService(dataSource),
    );
    notices = new BotNoticeRepository(
      dataSource.getRepository(BotNoticeOrmEntity),
      new BotNoticeMapper(),
      new OutboxService(dataSource),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  beforeEach(async () => {
    organizationId = await insertOrganization();
    userId = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [userId, `${userId}@example.com`],
    );
  });

  async function insertOrganization(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [id, `acme-${id.slice(0, 8)}`],
    );
    return id;
  }

  async function create(name = 'Ops', organization = organizationId): Promise<BotEntity> {
    const bot = BotEntity.createNew({
      organizationId: organization,
      createdByUserId: userId,
      name,
      description: '',
      avatarColor: 'mint',
      groupId: null,
      homeHostId: null,
      provider: 'anthropic',
    });
    const docs = (['soul', 'instructions'] as const).map((doc) =>
      BotDocumentEntity.initial({
        organizationId: bot.organizationId,
        botId: bot.id,
        name: doc,
        content: '',
        actor: userActor(userId),
      }),
    );
    expect(await bots.insert(bot, docs)).toBe('saved');
    return bot;
  }

  const send = async (bot: BotEntity, text: string) => {
    const notice = BotNoticeEntity.send({
      organizationId: bot.organizationId,
      botId: bot.id,
      text,
    });
    await notices.put(notice);
    return notice;
  };

  // The regression: an upsert that kept the row's first id, so the Inbox's
  // mark on the first notice hid every later one.
  it('replaces the bot’s notice with the new one, under the new notice’s id', async () => {
    const bot = await create();
    const first = await send(bot, 'Tests pass.');
    const second = await send(bot, 'Deployed to staging.');

    const rows: { id: string; text: string }[] = await dataSource.query(
      `SELECT id, text FROM bot_notice WHERE "botId" = $1`,
      [bot.id],
    );
    expect(rows).toEqual([{ id: second.id, text: 'Deployed to staging.' }]);
    expect(second.id).not.toBe(first.id);
  });

  it('stages each notice’s event with its write', async () => {
    const bot = await create();
    const notice = await send(bot, 'Tests pass.');
    const staged: { count: string }[] = await dataSource.query(
      `SELECT count(*) FROM outbox_message
       WHERE "eventName" = 'BotNoticeChangedDomainEvent' AND "aggregateId" = $1`,
      [notice.id],
    );
    expect(staged[0].count).toBe('1');
    expect(notice.domainEvents).toEqual([]);
  });

  it('reads the workspace’s notices newest first, each with its bot’s name, and none of another workspace', async () => {
    const ops = await create('Ops');
    const docs = await create('Docs');
    const elsewhere = await create('Other', await insertOrganization());
    await send(ops, 'Ops first.');
    await send(docs, 'Docs.');
    await send(elsewhere, 'Not yours.');
    await send(ops, 'Ops again.');

    const found = await notices.findInWorkspace(scopeOf(organizationId), 50);
    // The name comes from the same read: a regression to a second roster
    // read, or a join that pairs rows wrongly, names the wrong bot.
    expect(found.map(({ notice, botName }) => [botName, notice.text])).toEqual([
      ['Ops', 'Ops again.'],
      ['Docs', 'Docs.'],
    ]);
  });

  it('refuses a blank line in the table too', async () => {
    const bot = await create();
    await expect(
      dataSource.query(
        `INSERT INTO bot_notice ("organizationId", "botId", text) VALUES ($1, $2, '   ')`,
        [bot.organizationId, bot.id],
      ),
    ).rejects.toMatchObject({ driverError: { constraint: 'CHK_bot_notice_text' } });
  });

  it('goes with its bot', async () => {
    const bot = await create();
    await send(bot, 'Tests pass.');
    await dataSource.query(`DELETE FROM bot WHERE id = $1`, [bot.id]);
    const rows: unknown[] = await dataSource.query(`SELECT 1 FROM bot_notice WHERE "botId" = $1`, [
      bot.id,
    ]);
    expect(rows).toEqual([]);
  });
});
