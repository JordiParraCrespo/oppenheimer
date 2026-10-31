import { readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { newMigrationFile } from './migration-file';

/** `pnpm migration:new <PascalName>`: writes the skeleton of a new migration. */
const MIGRATIONS_DIR = resolve(__dirname, '../migrations');
const REPO_ROOT = resolve(__dirname, '../../../..');

const [name = ''] = process.argv.slice(2).filter((arg) => arg !== '--');
const existing = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.ts'));
const file = newMigrationFile(name, Date.now(), existing);

if ('error' in file) {
  console.error(`${file.error}\nUsage: pnpm migration:new <PascalName>`);
  process.exit(1);
}

const path = resolve(MIGRATIONS_DIR, file.fileName);
writeFileSync(path, file.source, { flag: 'wx' });
console.log(`Created ${relative(REPO_ROOT, path)} (${file.className})`);
