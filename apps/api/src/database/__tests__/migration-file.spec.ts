import { describe, expect, it } from 'vitest';
import { newMigrationFile, UNWRITTEN_MARKER } from '../migration-file';

/**
 * What `pnpm migration:new` writes: a file and class the TypeORM loader and the
 * `migration-timestamps` meta-test both read as `<Name><13-digit timestamp>`, and the
 * names it refuses before writing anything. The CLI around it only reads the
 * directory and the clock.
 */

const NOW = 1793450465389;
const EXISTING = ['1790900000000-InitialSchema.ts', '1791005600000-AddMailTriggers.ts'];

describe('newMigrationFile', () => {
  it('names the file and the class for the name and the moment it was created', () => {
    const file = newMigrationFile('AddInvoices', NOW, EXISTING);

    expect(file).toMatchObject({
      fileName: '1793450465389-AddInvoices.ts',
      className: 'AddInvoices1793450465389',
    });
  });

  it('writes a skeleton the meta-test reads as <Name><timestamp>, marked unwritten', () => {
    const file = newMigrationFile('AddInvoices', NOW, EXISTING);
    if ('error' in file) throw new Error(file.error);

    expect(file.source).toContain(
      'export class AddInvoices1793450465389 implements MigrationInterface',
    );
    expect(file.source).toContain("name = 'AddInvoices1793450465389';");
    expect(file.source).toContain(
      "import type { MigrationInterface, QueryRunner } from 'typeorm';",
    );
    expect(file.source).toContain(UNWRITTEN_MARKER);
  });

  it.each([
    ['', 'empty'],
    ['addInvoices', 'not capitalised'],
    ['Add-Invoices', 'punctuation'],
    ['AddInvoicesV2', 'a digit, which the timestamp would swallow'],
    ['1791005600000-AddInvoices', 'a pasted file name'],
  ])('refuses %j (%s)', (name) => {
    expect(newMigrationFile(name, NOW, EXISTING)).toHaveProperty('error');
  });

  it('refuses a name an existing migration already has, whatever its timestamp', () => {
    expect(newMigrationFile('AddMailTriggers', NOW, EXISTING)).toEqual({
      error: 'A migration named AddMailTriggers already exists: 1791005600000-AddMailTriggers.ts',
    });
  });

  it('refuses a timestamp an existing migration already holds', () => {
    expect(newMigrationFile('AddInvoices', 1791005600000, EXISTING)).toHaveProperty('error');
  });
});
