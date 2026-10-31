/**
 * The on-disk shape of a migration, and what `pnpm migration:new <Name>` writes:
 * `src/migrations/<timestamp>-<Name>.ts` exporting `<Name><timestamp>`, the
 * timestamp being the moment it was created. The generator and the
 * `migration-timestamps` meta-test both read names through the parsers here.
 *
 * The clock, not "the newest migration plus one step", is what keeps parallel
 * branches apart: two branches that each counted up from main's newest picked
 * the same number, and whichever merged second had to renumber. TypeORM does
 * not need a new migration to be later than the ones a database already ran:
 * it runs every pending one, in timestamp order, after them.
 */

/** In the skeleton's header until someone writes it; the meta-test refuses a file that still has it. */
export const UNWRITTEN_MARKER = 'TODO(migration:new)';

/**
 * Letters only, starting with a capital: the timestamp is read off the end of the
 * class name, so a digit in the name would run into it.
 */
const NAME = /^[A-Z][A-Za-z]*$/;

/** `<13-digit timestamp>-<Name>.ts`, the one shape a migration's file name takes. */
const FILE_NAME = /^(\d{13})-([A-Z][A-Za-z]*)\.ts$/;

/** `export class <Name><13-digit timestamp> implements MigrationInterface`, as TypeORM reads it. */
const CLASS_DECLARATION = /export class ([A-Z][A-Za-z]*?)(\d{13}) implements MigrationInterface/;

export interface MigrationStamp {
  timestamp: string;
  name: string;
}

/** The timestamp and name a migration's file name carries, or null when it is not one. */
export function parseMigrationFileName(file: string): MigrationStamp | null {
  const match = FILE_NAME.exec(file);
  return match ? { timestamp: match[1], name: match[2] } : null;
}

/** The timestamp and name of the migration class a file's source exports, or null. */
export function parseMigrationClass(source: string): MigrationStamp | null {
  const match = CLASS_DECLARATION.exec(source);
  return match ? { timestamp: match[2], name: match[1] } : null;
}

export interface MigrationFile {
  fileName: string;
  className: string;
  source: string;
}

export type MigrationFileResult = MigrationFile | { error: string };

/**
 * The file for a migration called `name`, created at `timestamp` (ms since the
 * epoch), or why it cannot be: a name that is not PascalCase letters, one an
 * existing migration in `existingFiles` already has, or a timestamp one already
 * holds.
 */
export function newMigrationFile(
  name: string,
  timestamp: number,
  existingFiles: readonly string[],
): MigrationFileResult {
  if (!NAME.test(name)) {
    return {
      error: `"${name}" is not a migration name: PascalCase letters only, named for what it does (AddInvoices)`,
    };
  }
  const stamp = String(timestamp);
  if (!/^\d{13}$/.test(stamp)) {
    return { error: `${timestamp} is not a 13-digit millisecond timestamp` };
  }
  const existing = existingFiles.map((file) => ({ file, parsed: parseMigrationFileName(file) }));
  const taken = existing.find(({ parsed }) => parsed?.name === name);
  if (taken) {
    return { error: `A migration named ${name} already exists: ${taken.file}` };
  }
  const sameStamp = existing.find(({ parsed }) => parsed?.timestamp === stamp);
  if (sameStamp) {
    return { error: `${sameStamp.file} already has timestamp ${stamp}; run the command again` };
  }

  const className = `${name}${stamp}`;
  return { fileName: `${stamp}-${name}.ts`, className, source: skeleton(className) };
}

function skeleton(className: string): string {
  return `import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ${UNWRITTEN_MARKER}: why this migration exists. The design decisions, the
 * relationships considered and anything deliberately left out
 * (\`.agents/rules/database-design.md\`, "Migrations").
 */
export class ${className} implements MigrationInterface {
  name = '${className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`\`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`\`);
  }
}
`;
}
