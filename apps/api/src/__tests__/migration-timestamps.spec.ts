import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every migration has a timestamp of its own.
 *
 * TypeORM orders migrations by the 13-digit timestamp at the end of the class
 * name and records each one by that name. Two migrations with the same
 * timestamp have no defined order: the TypeORM CLI, which globs the directory
 * as the API does at boot, and the integration suites (`runAllMigrations`,
 * which sorts file names) could apply such a pair in opposite orders. So a new
 * migration takes a timestamp later than the newest one, and this fails on one
 * that shares a timestamp.
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
});
