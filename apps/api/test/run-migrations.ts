import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { MigrationInterface } from 'typeorm';
import { DataSource } from 'typeorm';

const MIGRATIONS_DIR = resolve(__dirname, '../src/migrations');

/**
 * Build the test schema by running the **whole** migration chain.
 *
 * The chain is discovered from the directory rather than listed by hand.
 * A hand-maintained list silently drifts the moment someone adds a migration
 * and forgets this file: the suite then runs against a schema that is missing
 * columns the entities declare, and every affected route fails with an opaque
 * 500 rather than pointing at the omission.
 */
export async function runAllMigrations(): Promise<void> {
  const migrations = await loadMigrations();

  const runner = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME ?? 'test',
    password: process.env.DB_PASSWORD ?? 'test',
    database: process.env.DB_DATABASE ?? 'test',
    migrations,
  });

  await runner.initialize();
  await runner.runMigrations();
  await runner.destroy();
}

/**
 * Every migration class, ordered by the timestamp in its filename — the same
 * order TypeORM applies them in production.
 */
async function loadMigrations(): Promise<(new () => MigrationInterface)[]> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
  }

  const loaded = await Promise.all(files.map((file) => import(join(MIGRATIONS_DIR, file))));

  return loaded.flatMap((module) =>
    Object.values(module).filter(
      (exported): exported is new () => MigrationInterface => typeof exported === 'function',
    ),
  );
}
