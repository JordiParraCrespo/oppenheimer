import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { CiFindingMapper } from '../ci-finding.mapper';
import { CiFindingOrmEntity } from '../database/ci-finding.orm-entity';
import { CiFindingRepository } from '../database/ci-finding.repository';
import { CiFindingEntity, type CiFindingProps } from '../domain/ci-finding.entity';

/**
 * What failing checks came to, filed against a pull request's head
 * (`1791005200000-AddCiFindings`): a second look at a check on the same commit
 * replaces the first and keeps its row, a push's new head starts empty, and a
 * workspace reads only its own. The checks the table holds are its own
 * contract, so a row they forbid is refused here.
 */
describe('CI findings (integration)', () => {
  let dataSource: DataSource;
  let findings: CiFindingRepository;
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
      entities: [CiFindingOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    findings = new CiFindingRepository(
      dataSource.getRepository(CiFindingOrmEntity),
      new CiFindingMapper(),
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  async function insertOrganization(): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [id, `acme-${id.slice(0, 8)}`],
    );
    return id;
  }

  beforeEach(async () => {
    organizationId = await insertOrganization();
    userId = randomUUID();
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [userId, `${userId}@example.com`],
    );
  });

  const finding = (over: Partial<CiFindingProps> = {}) =>
    CiFindingEntity.record({
      organizationId,
      githubRepoId: 42,
      number: 14,
      headSha: 'abc123',
      check: 'unit',
      rootCause: 'The parser rejects an empty date.',
      relation: 'this_change',
      flake: 'real',
      action: 'fix_here',
      next: 'Accept an empty date in parseDate.',
      confidence: 'high',
      evidence: ['src/date.ts:12'],
      recordedByUserId: userId,
      recordedByBotId: null,
      ...over,
    });
  const head = { githubRepoId: 42, number: 14, headSha: 'abc123' };

  it('replaces a second look at a check on the same commit, keeping its row', async () => {
    await findings.record([finding(), finding({ check: 'lint', action: 'rerun', flake: 'flake' })]);
    const before = await findings.findForHead(scopeOf(organizationId), head);
    const unitId = before.find((row) => row.check === 'unit')?.id;
    await findings.record([
      finding({ rootCause: 'A flaky clock.', flake: 'flake', action: 'rerun', confidence: 'low' }),
    ]);
    const read = await findings.findForHead(scopeOf(organizationId), head);
    expect(read.map((row) => [row.check, row.flake, row.action])).toEqual([
      ['lint', 'flake', 'rerun'],
      ['unit', 'flake', 'rerun'],
    ]);
    expect(read.find((row) => row.check === 'unit')).toMatchObject({
      id: unitId,
      rootCause: 'A flaky clock.',
      confidence: 'low',
    });
  });

  it('files a new head apart, and reads nothing of another workspace', async () => {
    await findings.record([finding(), finding({ headSha: 'def456' })]);
    expect(await findings.findForHead(scopeOf(organizationId), head)).toHaveLength(1);
    expect(
      await findings.findForHead(scopeOf(organizationId), { ...head, headSha: 'def456' }),
    ).toHaveLength(1);
    expect(await findings.findForHead(scopeOf(await insertOrganization()), head)).toEqual([]);
  });

  it('refuses a verdict the checks do not list', async () => {
    await findings.record([finding()]);
    await expect(
      dataSource.query(
        `UPDATE pull_request_ci_finding SET flake = 'maybe' WHERE "organizationId" = $1`,
        [organizationId],
      ),
    ).rejects.toThrow(/CHK_pull_request_ci_finding_flake/);
  });
});
