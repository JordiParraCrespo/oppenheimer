/**
 * What `pnpm migration:new <Name>` writes: `src/migrations/<timestamp>-<Name>.ts`
 * exporting `<Name><timestamp>`, the timestamp being the moment it was created.
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
 * class name, and the meta-test splits the two at the first digit.
 */
const NAME = /^[A-Z][A-Za-z]*$/;

export interface MigrationFile {
  fileName: string;
  className: string;
  source: string;
}

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
): MigrationFile | { error: string } {
  if (!NAME.test(name)) {
    return {
      error: `"${name}" is not a migration name: PascalCase letters only, named for what it does (AddInvoices)`,
    };
  }
  const stamp = String(timestamp);
  if (!/^\d{13}$/.test(stamp)) {
    return { error: `${timestamp} is not a 13-digit millisecond timestamp` };
  }
  const taken = existingFiles.find(
    (file) => file.replace(/^\d+-/, '').replace(/\.ts$/, '') === name,
  );
  if (taken) {
    return { error: `A migration named ${name} already exists: ${taken}` };
  }
  const sameStamp = existingFiles.find((file) => file.startsWith(`${stamp}-`));
  if (sameStamp) {
    return { error: `${sameStamp} already has timestamp ${stamp}; run the command again` };
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
