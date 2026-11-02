import { DataSource } from 'typeorm';
import { useTestDatabase } from '../../__tests__/integration-services';
import { WatchedRepositoryOrmEntity } from '../../pull-requests/database/watched-repository.orm-entity';
import { GithubTokenOrmEntity } from '../database/github-token.orm-entity';
import { GithubTokenRepository } from '../database/github-token.repository';
import { GithubTokenPinOrmEntity } from '../database/github-token-pin.orm-entity';

/**
 * A person's own GitHub tokens and pins (§6.2), and the watch of a repository
 * read through them, against a real Postgres: what no double can be wrong
 * about. The label unique answered as `label_taken`, a pin that cannot name
 * somebody else's token, pins going with their token, and one watch per token
 * repository even though its installation is null.
 */
describe('GitHub tokens schema (integration)', () => {
  let dataSource: DataSource;
  let tokens: GithubTokenRepository;

  const ANA = '33333333-3333-4333-8333-333333333333';
  const BRUNO = '44444444-4444-4444-8444-444444444444';
  const ORG = '11111111-1111-4111-8111-111111111111';

  beforeAll(async () => {
    const db = await useTestDatabase();

    dataSource = new DataSource({
      type: 'postgres',
      url: db.url,
      entities: [GithubTokenOrmEntity, GithubTokenPinOrmEntity, WatchedRepositoryOrmEntity],
    });
    await dataSource.initialize();
    tokens = new GithubTokenRepository(
      dataSource.getRepository(GithubTokenOrmEntity),
      dataSource.getRepository(GithubTokenPinOrmEntity),
    );

    for (const [id, email] of [
      [ANA, 'ana@example.com'],
      [BRUNO, 'bruno@example.com'],
    ]) {
      await dataSource.query(
        `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
           VALUES ($1, 'Someone', $2, 'Some', 'One')`,
        [id, email],
      );
    }
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'acme', 'acme')`,
      [ORG],
    );
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
  });

  const token = (userId: string, label: string, repositoryIds: number[] = [7]) => ({
    userId,
    label,
    kind: 'fine_grained' as const,
    githubUserId: 583231,
    login: 'ana-dev',
    tokenSealed: Buffer.from('sealed'),
    scopes: null,
    expiresAt: null,
    repositories: repositoryIds.map((githubRepoId) => ({
      githubRepoId,
      name: `repo-${githubRepoId}`,
      fullName: `acme/repo-${githubRepoId}`,
      defaultBranch: 'main',
      private: true,
      archived: false,
    })),
    checkedAt: new Date(),
  });

  async function added(userId: string, label: string, repositoryIds?: number[]) {
    const result = await tokens.insert(token(userId, label, repositoryIds));
    if (result === 'label_taken') throw new Error('label taken');
    return result.id;
  }

  it('keeps what a token opens and gives it back whole, oldest token first', async () => {
    const first = await added(ANA, 'first', [7, 8]);
    const second = await added(ANA, 'second', [9]);

    const own = await tokens.findOwn(ANA);

    expect(own.map((t) => t.id)).toEqual([first, second]);
    expect(own[0]?.repositories.map((r) => r.githubRepoId)).toEqual([7, 8]);
    expect(own[0]?.githubUserId).toBe(583231);
  });

  it('answers a second token with the same label as label_taken, for that person only', async () => {
    await added(ANA, 'acme');

    expect(await tokens.insert(token(ANA, 'acme'))).toBe('label_taken');
    expect(await tokens.insert(token(BRUNO, 'acme'))).toMatchObject({ id: expect.any(String) });
  });

  it('finds, renames and deletes nobody else’s token', async () => {
    const anas = await added(ANA, 'private');

    expect(await tokens.findOneOwn(BRUNO, anas)).toBeNull();
    expect(await tokens.relabel(BRUNO, anas, 'mine now')).toBe(false);
    expect(await tokens.delete(BRUNO, anas)).toBe(false);
    expect(await tokens.findOneOwn(ANA, anas)).not.toBeNull();
  });

  it('refuses a pin that names somebody else’s token', async () => {
    const brunos = await added(BRUNO, 'brunos');

    await expect(tokens.pin(ANA, { githubRepoId: 7, tokenId: brunos })).rejects.toThrow(
      /FK_github_token_pin_token/,
    );
  });

  it('replaces a repository’s pin, and drops it with its token', async () => {
    const narrow = await added(ANA, 'narrow');
    const wide = await added(ANA, 'wide', [7, 8, 9]);

    await tokens.pin(ANA, { githubRepoId: 7, tokenId: narrow });
    await tokens.pin(ANA, { githubRepoId: 7, tokenId: wide });
    expect(await tokens.findPins(ANA)).toEqual([{ githubRepoId: 7, tokenId: wide }]);

    await tokens.delete(ANA, wide);
    expect(await tokens.findPins(ANA)).toEqual([]);
  });

  it('clears a refusal when a check succeeds', async () => {
    const id = await added(ANA, 'refused once');
    await tokens.recordRefusal(ANA, id, new Date());
    expect((await tokens.findOneOwn(ANA, id))?.refusedAt).not.toBeNull();

    await tokens.recordCheck(ANA, id, { ...token(ANA, 'x'), checkedAt: new Date() });

    expect((await tokens.findOneOwn(ANA, id))?.refusedAt).toBeNull();
  });

  // `NULLS NOT DISTINCT`: without it every watch of a token repository is a new row.
  it('keeps one watch of a repository read through tokens', async () => {
    const watch = `INSERT INTO "watched_repository" ("organizationId", "userId", "installationId", "githubRepoId")
                     VALUES ($1, $2, NULL, 7)`;
    await dataSource.query(watch, [ORG, ANA]);

    await expect(dataSource.query(watch, [ORG, ANA])).rejects.toThrow(/UQ_watched_repository/);
  });
});
