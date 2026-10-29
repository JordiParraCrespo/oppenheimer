import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { BotMapper } from '../../bots/bot.mapper';
import { BotDocumentMapper } from '../../bots/bot-document.mapper';
import { BotOrmEntity } from '../../bots/database/bot.orm-entity';
import { BotRepository } from '../../bots/database/bot.repository';
import { BotDocumentOrmEntity } from '../../bots/database/bot-document.orm-entity';
import { BotDocumentRevisionOrmEntity } from '../../bots/database/bot-document-revision.orm-entity';
import { BotEntity } from '../../bots/domain/bot.entity';
import { userActor } from '../../bots/domain/bot.types';
import { BotDocumentEntity } from '../../bots/domain/bot-document.entity';
import { BotPermissionRuleMapper } from '../bot-permission-rule.mapper';
import { BotToolPermissionMapper } from '../bot-tool-permission.mapper';
import { BotPermissionRuleOrmEntity } from '../database/bot-permission-rule.orm-entity';
import { BotPermissionRuleRepository } from '../database/bot-permission-rule.repository';
import { BotToolPermissionOrmEntity } from '../database/bot-tool-permission.orm-entity';
import { BotToolPermissionRepository } from '../database/bot-tool-permission.repository';
import { BotPermissionRuleEntity } from '../domain/bot-permission-rule.entity';
import { BotToolPermissionEntity } from '../domain/bot-tool-permission.entity';

/**
 * A bot's tool settings, grants and rules against a real Postgres
 * (`product/versions/mvp/25-bots.md` §5): one decision per tool however
 * often it is set (`NULLS NOT DISTINCT`), a decision and a grant side by
 * side, the grant and rule caps counted under the bot's lock so two racing
 * writes cannot pass them, deletes reaching only the caller's workspace and
 * only grants, and everything gone with the bot. How a setting decides a
 * call is the policy spec's.
 */
describe('bot permissions (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let bots: BotRepository;
  let settings: BotToolPermissionRepository;
  let rules: BotPermissionRuleRepository;
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
      entities: [
        BotOrmEntity,
        BotDocumentOrmEntity,
        BotDocumentRevisionOrmEntity,
        BotToolPermissionOrmEntity,
        BotPermissionRuleOrmEntity,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    bots = new BotRepository(
      dataSource.getRepository(BotOrmEntity),
      dataSource,
      new BotMapper(),
      new BotDocumentMapper(),
    );
    settings = new BotToolPermissionRepository(
      dataSource.getRepository(BotToolPermissionOrmEntity),
      dataSource,
      new BotToolPermissionMapper(),
    );
    rules = new BotPermissionRuleRepository(
      dataSource.getRepository(BotPermissionRuleOrmEntity),
      dataSource,
      new BotPermissionRuleMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pg?.stop();
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

  async function create(organization = organizationId): Promise<BotEntity> {
    const bot = BotEntity.createNew({
      organizationId: organization,
      createdByUserId: userId,
      name: 'Ops',
      description: '',
      avatarColor: 'mint',
      groupId: null,
      homeHostId: null,
      provider: 'anthropic',
    });
    const docs = (['soul', 'instructions'] as const).map((name) =>
      BotDocumentEntity.initial({
        organizationId: bot.organizationId,
        botId: bot.id,
        name,
        content: '',
        actor: userActor(userId),
      }),
    );
    expect(await bots.insert(bot, docs)).toBe('saved');
    return bot;
  }

  const decision = (bot: BotEntity, tool: string, value: 'allow' | 'ask' | 'off') =>
    BotToolPermissionEntity.decide({
      organizationId: bot.organizationId,
      botId: bot.id,
      tool,
      decision: value,
      userId,
    });
  const grant = (bot: BotEntity, key: string, tool = 'comment_on_pull_request') =>
    BotToolPermissionEntity.grant({
      organizationId: bot.organizationId,
      botId: bot.id,
      tool,
      subject: { kind: 'repository', key, label: key },
      userId,
    });
  const rule = (bot: BotEntity, text: string) =>
    BotPermissionRuleEntity.write({
      organizationId: bot.organizationId,
      botId: bot.id,
      effect: 'ask',
      text,
      userId,
    });

  it('keeps one decision per tool however often it is set, beside the tool’s grants', async () => {
    const bot = await create();
    expect(await settings.setDecision(decision(bot, 'comment_on_pull_request', 'allow'))).toBe(
      'saved',
    );
    expect(await settings.setDecision(decision(bot, 'comment_on_pull_request', 'off'))).toBe(
      'saved',
    );
    expect(await settings.insertGrant(grant(bot, 'acme/docs'), 10)).toBe('inserted');

    const rows = await settings.findAllForTurn(organizationId, bot.id);
    expect(rows.map((row) => [row.tool, row.decision, row.subject?.key ?? null])).toEqual([
      ['comment_on_pull_request', 'allow', 'acme/docs'],
      ['comment_on_pull_request', 'off', null],
    ]);

    await settings.clearDecision(organizationId, bot.id, 'comment_on_pull_request');
    const left = await settings.findAll(scopeOf(organizationId), bot.id);
    expect(left.map((row) => row.subject?.key)).toEqual(['acme/docs']);
  });

  it('refuses a second null-subject row for a tool at the database, not only in the upsert', async () => {
    const bot = await create();
    await settings.setDecision(decision(bot, 'recall', 'off'));
    await expect(
      dataSource.query(
        `INSERT INTO bot_tool_permission ("organizationId", "botId", "tool", "decision")
         VALUES ($1, $2, 'recall', 'ask')`,
        [organizationId, bot.id],
      ),
    ).rejects.toThrow(/UQ_bot_tool_permission/);
  });

  it('writes nothing for a bot that is gone, or in another workspace', async () => {
    const bot = await create();
    const elsewhere = BotToolPermissionEntity.decide({
      organizationId: await insertOrganization(),
      botId: bot.id,
      tool: 'recall',
      decision: 'off',
      userId,
    });
    expect(await settings.setDecision(elsewhere)).toBe('missing');
    await bots.delete(bot);
    expect(await settings.setDecision(decision(bot, 'recall', 'off'))).toBe('missing');
    expect(await settings.insertGrant(grant(bot, 'acme/docs'), 10)).toBe('missing');
    expect(await rules.insert(rule(bot, 'Ask before payments'), 10)).toBe('missing');
  });

  it('keeps a grant given twice once, and stops at the cap', async () => {
    const bot = await create();
    expect(await settings.insertGrant(grant(bot, 'acme/docs'), 2)).toBe('inserted');
    expect(await settings.insertGrant(grant(bot, 'acme/docs'), 2)).toBe('exists');
    expect(await settings.insertGrant(grant(bot, 'acme/api'), 2)).toBe('inserted');
    expect(await settings.insertGrant(grant(bot, 'acme/web'), 2)).toBe('full');
    // A tool's own decision is not a grant and does not count.
    await settings.setDecision(decision(bot, 'recall', 'off'));
    expect(await settings.findAllForTurn(organizationId, bot.id)).toHaveLength(3);
  });

  it('lets one of two racing grants take the last place', async () => {
    const bot = await create();
    await settings.insertGrant(grant(bot, 'acme/docs'), 2);
    const outcomes = await Promise.all([
      settings.insertGrant(grant(bot, 'acme/api'), 2),
      settings.insertGrant(grant(bot, 'acme/web'), 2),
    ]);
    expect(outcomes.sort()).toEqual(['full', 'inserted']);
  });

  it('lets one of two racing rules take the last place, and reads rules oldest first', async () => {
    const bot = await create();
    expect(await rules.insert(rule(bot, 'Ask before payments'), 2)).toBe('inserted');
    const outcomes = await Promise.all([
      rules.insert(rule(bot, 'Ask before deleting'), 2),
      rules.insert(rule(bot, 'Ask before merging'), 2),
    ]);
    expect(outcomes.sort()).toEqual(['full', 'inserted']);
    const read = await rules.findAll(scopeOf(organizationId), bot.id);
    expect(read[0].text).toBe('Ask before payments');
    expect(read).toHaveLength(2);
  });

  it('deletes a grant or a rule only in the caller’s workspace, and never a decision as a grant', async () => {
    const bot = await create();
    const given = grant(bot, 'acme/docs');
    await settings.insertGrant(given, 10);
    const decided = decision(bot, 'recall', 'off');
    await settings.setDecision(decided);
    const written = rule(bot, 'Ask before payments');
    await rules.insert(written, 10);
    const stranger = scopeOf(await insertOrganization());

    expect(await settings.deleteGrant(stranger, bot.id, given.id)).toBe(false);
    expect(await rules.delete(stranger, bot.id, written.id)).toBe(false);
    expect(await settings.deleteGrant(scopeOf(organizationId), bot.id, decided.id)).toBe(false);

    expect(await settings.deleteGrant(scopeOf(organizationId), bot.id, given.id)).toBe(true);
    expect(await rules.delete(scopeOf(organizationId), bot.id, written.id)).toBe(true);
    const left = await settings.findAllForTurn(organizationId, bot.id);
    expect(left.map((row) => row.tool)).toEqual(['recall']);
    expect(await rules.findAllForTurn(organizationId, bot.id)).toEqual([]);
  });

  it('goes with its bot', async () => {
    const bot = await create();
    await settings.setDecision(decision(bot, 'recall', 'off'));
    await settings.insertGrant(grant(bot, 'acme/docs'), 10);
    await rules.insert(rule(bot, 'Ask before payments'), 10);
    await bots.delete(bot);
    const [{ count }]: { count: number }[] = await dataSource.query(
      `SELECT (SELECT count(*) FROM bot_tool_permission WHERE "botId" = $1)
            + (SELECT count(*) FROM bot_permission_rule WHERE "botId" = $1) AS count`,
      [bot.id],
    );
    expect(Number(count)).toBe(0);
  });
});
