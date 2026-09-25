#!/usr/bin/env node
// Prove a new migration on a real Postgres before anyone reviews it.
//
//   node --experimental-strip-types .agents/skills/design-database/scripts/check-migration.mjs \
//     apps/api/src/migrations/1789000000000-AddInvoices.ts [more.ts...] \
//     [--before stubs.sql] [--fixture fixture.sql] [--explain queries.sql] [--keep]
//
// It creates a scratch database next to the one in the root `.env` (DB_* —
// `pnpm docker:dev` starts it), then:
//
//   1. applies every existing migration in apps/api/src/migrations (the ones
//      not named on the command line), in one transaction, as boot does;
//   2. seeds a few rows (two users, an organization, memberships, a session,
//      an account), so the candidate meets populated tables the way
//      production does: a NOT NULL column without a default fails here too;
//   3. runs --before SQL (tables the design assumes but the repo does not
//      have yet), then the candidates' up() in one transaction, then down() in reverse,
//      then up() again — so down() is proven to reverse up();
//   4. runs --fixture SQL (rows for your new tables), then prints the plan of
//      every statement in --explain with sequential scans disabled, so each
//      access pattern is shown to be served by the index designed for it —
//      and a `Sort` node above it means the index does not give the order;
//   5. drops the scratch database (unless --keep).
//
// Migrations run for real: queries get real results, and a migration that
// sets `transaction = false` runs without the wrapping transaction.
// Exit code 0 means every step passed.
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const migrationsDir = join(root, 'apps/api/src/migrations');

// `pg` is the API's own dependency.
const loadPg = () => {
  for (const from of [join(root, 'apps/api/package.json'), join(root, 'package.json')]) {
    try {
      return createRequire(from)('pg');
    } catch {}
  }
  if (process.env.PG_MODULE_PATH) return createRequire(process.env.PG_MODULE_PATH)('pg');
  throw new Error('Cannot find the `pg` package: run `pnpm install` first.');
};
const pg = loadPg();

// Root `.env`, without a dependency: real environment variables win.
const env = { ...process.env };
try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}
const conn = (database) => ({
  host: env.DB_HOST || 'localhost',
  port: Number(env.DB_PORT || 5432),
  user: env.DB_USERNAME || 'oppenheimer',
  password: env.DB_PASSWORD || 'oppenheimer',
  database,
});

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const before = opt('--before');
const fixture = opt('--fixture');
const explain = opt('--explain');
const keep = args.includes('--keep') && args.splice(args.indexOf('--keep'), 1);
const candidates = args.map((f) => resolve(f));
if (candidates.length === 0) {
  console.error(
    'usage: check-migration.mjs <migration.ts>... [--before f.sql] [--fixture f.sql] [--explain q.sql] [--keep]',
  );
  process.exit(2);
}
const existing = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => join(migrationsDir, f))
  .filter((f) => !candidates.includes(f))
  .sort();

// A migration file only imports types from typeorm; strip the imports and load it.
const load = async (file) => {
  const src = readFileSync(file, 'utf8').replace(/^import[^;]*from\s+['"][^'"]+['"];?\s*$/gm, '');
  const out = join(mkdtempSync(join(tmpdir(), 'migcheck-')), 'm.mts');
  writeFileSync(out, src);
  const mod = await import(out);
  const Migration = Object.values(mod).find((v) => typeof v === 'function');
  return new Migration();
};

const run = async (client, files, direction) => {
  const migrations = [];
  for (const f of files) migrations.push({ f, m: await load(f) });
  if (direction === 'down') migrations.reverse();
  const noTx = migrations.some(({ m }) => m.transaction === false);
  let active = false;
  const runner = {
    query: async (sql, params) => (await client.query(sql, params)).rows,
    get isTransactionActive() {
      return active;
    },
    startTransaction: async () => {
      await client.query('BEGIN');
      active = true;
    },
    commitTransaction: async () => {
      await client.query('COMMIT');
      active = false;
    },
    rollbackTransaction: async () => {
      await client.query('ROLLBACK');
      active = false;
    },
    connection: { options: {}, driver: { options: {} }, logger: { log() {}, logQuery() {} } },
  };
  try {
    if (!noTx) await runner.startTransaction();
    for (const { f, m } of migrations) {
      try {
        await m[direction](runner);
      } catch (e) {
        throw new Error(`${f.split('/').pop()} ${direction}(): ${e.message}${e.detail ? ` — ${e.detail}` : ''}`);
      }
    }
    if (!noTx) await runner.commitTransaction();
    return noTx ? 'without a wrapping transaction (a migration sets transaction = false)' : 'in one transaction';
  } catch (e) {
    if (active) await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
};

const SEED = `
INSERT INTO "user" ("id","name","email","firstName","lastName") VALUES
  ('00000000-0000-0000-0000-000000000001','Ada Admin','ada@example.com','Ada','Admin'),
  ('00000000-0000-0000-0000-000000000002','Bob Member','bob@example.com','Bob','Member');
INSERT INTO "organization" ("id","name","slug") VALUES ('00000000-0000-0000-0000-0000000000a1','Acme','acme');
INSERT INTO "member" ("id","organizationId","userId","role") VALUES
  (gen_random_uuid(),'00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','owner'),
  (gen_random_uuid(),'00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002','member');
INSERT INTO "session" ("id","userId","token","expiresAt") VALUES
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','seed-token', now() + interval '1 day');
INSERT INTO "account" ("id","userId","accountId","providerId") VALUES
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','ada','credential');`;

const scratch = `migcheck_${Date.now()}`;
const admin = new pg.Client(conn(env.DB_DATABASE || 'oppenheimer'));
await admin.connect();
await admin.query(`CREATE DATABASE "${scratch}"`);
const db = new pg.Client(conn(scratch));
let failed = false;
const step = async (label, fn) => {
  try {
    const note = await fn();
    console.log(`ok    ${label}${note ? ` (${note})` : ''}`);
  } catch (e) {
    console.log(`FAIL  ${label}\n      ${e.message}`);
    failed = true;
    throw e;
  }
};
try {
  await db.connect();
  await step(`${existing.length} existing migrations`, () => run(db, existing, 'up'));
  await step('seed rows', async () => void (await db.query(SEED)));
  if (before) await step(`before ${before}`, async () => void (await db.query(readFileSync(before, 'utf8'))));
  await step('candidate up()', () => run(db, candidates, 'up'));
  await step('candidate down()', () => run(db, candidates, 'down'));
  await step('candidate up() again', () => run(db, candidates, 'up'));
  if (fixture) await step(`fixture ${fixture}`, async () => void (await db.query(readFileSync(fixture, 'utf8'))));
  if (explain) {
    // Scratch tables are tiny, and on a tiny table the planner always prefers
    // a sequential scan. Turning it off asks the real question: can an index
    // serve this query, and does it still need a Sort on top?
    await db.query('ANALYZE');
    await db.query('SET enable_seqscan = off');
    console.log('      (plans below use enable_seqscan = off: they show whether an index can serve each query)');
    // One query per `;`-terminated chunk; a `-- comment` line above it names it.
    for (const chunk of readFileSync(explain, 'utf8').split(/;\s*(?:\n|$)/)) {
      const lines = chunk.split('\n');
      const body = lines.filter((l) => !/^\s*--/.test(l)).join('\n').trim();
      if (!body) continue;
      const comment = lines.find((l) => /^\s*--/.test(l));
      const title = comment ? comment.replace(/^\s*--\s*/, '') : body.split('\n')[0];
      await step(`explain: ${title}`, async () => {
        const rows = await db.query(`EXPLAIN ${body}`);
        console.log(rows.rows.map((r) => `      ${r['QUERY PLAN']}`).join('\n'));
      });
    }
  }
} catch {
  // reported by step()
} finally {
  await db.end().catch(() => {});
  if (keep) console.log(`kept scratch database ${scratch}`);
  else await admin.query(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
  await admin.end();
}
console.log(failed ? 'FAILED' : 'ALL OK');
process.exit(failed ? 1 : 0);
