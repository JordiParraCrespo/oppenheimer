import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every migration has a timestamp of its own.
 *
 * TypeORM orders migrations by the 13-digit timestamp at the end of the class
 * name and records each one by that name. Two migrations with the same
 * timestamp have no defined order: the TypeORM CLI, which globs the directory
 * as the API does at boot, and the integration suites
 * (`test/run-migrations.ts`, which sorts file names) already apply the three
 * pairs below in opposite orders. A pair is only safe when neither migration reads or writes anything
 * the other creates, and nothing checks that but a person. So a new migration
 * takes a timestamp later than the newest one, and this fails on one that
 * shares a timestamp.
 *
 * The three pairs below predate the check and have run on deployed databases,
 * where they are recorded by class name, so they keep their names. Each was
 * checked to be order-independent:
 */
const EXISTING_PAIRS: Record<string, string[]> = {
  // From the Flama starter. AddAdminAndOrganizations adds the admin and
  // organization columns to `user` and `session`, creates `organization`,
  // `member`, `team`, `teamMember` and `invitation`, and seeds `role` (from the
  // earlier AddRolesRbac); AddBilling creates `billing_customer` and
  // `subscription` (dropped since by DropBillingAndLeads), referencing only
  // `user`. Neither touches the other's tables.
  '1781000000000': ['AddAdminAndOrganizations', 'AddBilling'],
  // AddGithubInstallations creates `github_installation`; AddHosts creates
  // `host` and `host_pairing_token`. Both only reference `user` and
  // `organization`, seed nothing, and neither touches the other's tables.
  '1788700000000': ['AddGithubInstallations', 'AddHosts'],
  // AddHostInventoryAndPresence creates the `host_*` side tables and backfills
  // them from `host`; NameProjectsAndFlattenSessions changes `project`,
  // `project_repository` and `work_session` and reads `session_checkout` and
  // `organization`. Disjoint tables, and each down() drops only its own.
  '1789900000000': ['AddHostInventoryAndPresence', 'NameProjectsAndFlattenSessions'],
};

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
    expect(shared).toEqual(EXISTING_PAIRS);
  });
});
