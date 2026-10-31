import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UNWRITTEN_MARKER } from '../database/migration-file';

/**
 * Every migration has a timestamp of its own. TypeORM orders migrations by the 13-digit
 * timestamp ending the class name; two sharing one have no defined order, so the CLI
 * (which globs the directory, as the API does at boot) and the integration suites
 * (`runAllMigrations`, which sorts file names) could apply them in opposite orders.
 *
 * A new migration is written with `pnpm migration:new <Name>`, which stamps it with the
 * moment it was created. It does not have to be later than every migration on main:
 * TypeORM (0.3.31, `MigrationExecutor.executePendingMigrations`) runs every pending
 * migration, an older one included, in timestamp order after those already applied, in
 * the one boot transaction. Counting up from main's newest is what made parallel
 * branches pick the same number. The clock only orders migrations when nobody picks a
 * timestamp by hand, so none may be in the future.
 */
const MIGRATIONS_DIR = resolve(__dirname, '../migrations');

interface Migration {
  file: string;
  fileTimestamp: string;
  fileName: string;
  className?: string;
  classTimestamp?: string;
}

function migrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
    .map((file) => {
      const [, fileTimestamp = '', fileName = ''] = /^(\d+)-(.+)\.ts$/.exec(file) ?? [];
      const source = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
      const [, className, classTimestamp] =
        /export class ([A-Za-z]+?)(\d{13}) implements MigrationInterface/.exec(source) ?? [];
      return { file, fileTimestamp, fileName, className, classTimestamp };
    });
}

describe('migration timestamps', () => {
  const all = migrations();

  it('name each file <13-digit timestamp>-<ClassName>.ts after the class it exports', () => {
    const mismatched = all
      .filter(
        (m) =>
          m.fileTimestamp.length !== 13 ||
          m.className !== m.fileName ||
          m.classTimestamp !== m.fileTimestamp,
      )
      .map((m) => m.file);
    expect(mismatched).toEqual([]);
  });

  it('give every new migration a timestamp of its own', () => {
    const byTimestamp = new Map<string, string[]>();
    for (const m of all) {
      byTimestamp.set(m.fileTimestamp, [...(byTimestamp.get(m.fileTimestamp) ?? []), m.fileName]);
    }
    const shared = Object.fromEntries(
      [...byTimestamp]
        .filter(([, names]) => names.length > 1)
        .map(([timestamp, names]) => [timestamp, names.sort()]),
    );
    expect(shared).toEqual({});
  });

  it('stamp no migration later than now, so the clock keeps ordering them', () => {
    const now = Date.now();
    const future = all.filter((m) => Number(m.fileTimestamp) > now).map((m) => m.file);
    expect(future).toEqual([]);
  });

  it('leave no migration as the skeleton `migration:new` wrote', () => {
    const unwritten = all
      .filter((m) =>
        readFileSync(resolve(MIGRATIONS_DIR, m.file), 'utf8').includes(UNWRITTEN_MARKER),
      )
      .map((m) => m.file);
    expect(unwritten).toEqual([]);
  });
});
