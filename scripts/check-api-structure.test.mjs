/**
 * The module contract, tested against trees built for the purpose.
 *
 * Running the checker over the repository only says whether the repository
 * conforms today. It cannot tell a reworded message from a paid-off violation,
 * and it can never exercise a rule nothing currently breaks. These fixtures
 * pin the `kind` each breach reports, which is what the ledger keys on — so a
 * rename here is a visible, deliberate change rather than a silent one.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkApiStructure } from './check-api-structure.mjs';

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** Build a `src` tree from a {path: contents} map and check it. */
function check(files, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'oppenheimer-contract-'));
  roots.push(root);
  const src = join(root, 'src');
  for (const [path, contents] of Object.entries(files)) {
    const full = join(src, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents ?? '');
  }
  return checkApiStructure(src, { root, ledger: [], ...options });
}

const kinds = (result) => result.outstanding.map((e) => e.kind).sort();

/** A module that satisfies the contract, used as the base for the breaches. */
const CONFORMING = {
  'widget/widget.module.ts': 'export class WidgetModule {}',
  'widget/widget.mapper.ts': 'export class WidgetMapper {}',
  'widget/widget.di-tokens.ts': "export const WIDGET_REPOSITORY = Symbol('WIDGET_REPOSITORY');",
  'widget/domain/widget.entity.ts': 'export class WidgetEntity {}',
  'widget/domain/widget.errors.ts': 'export const WidgetErrors = {};',
  'widget/domain/value-objects/size.value-object.ts': 'export class Size {}',
  'widget/domain/events/widget-created.domain-event.ts': 'export class WidgetCreated {}',
  'widget/database/widget.orm-entity.ts': 'export class WidgetOrmEntity {}',
  'widget/database/widget.repository.port.ts': 'export interface WidgetRepositoryPort {}',
  'widget/database/widget.repository.ts': 'export class WidgetRepository {}',
  'widget/dtos/widget.response.dto.ts': 'export class WidgetResponseDto {}',
  'widget/commands/create-widget/create-widget.command.ts': 'export class CreateWidgetCommand {}',
  'widget/commands/create-widget/create-widget.command-handler.ts':
    'export class CreateWidgetCommandHandler {}',
  'widget/commands/create-widget/create-widget.http.controller.ts': '@Post()\nexport class C {}',
  'widget/commands/create-widget/create-widget.request.dto.ts': 'export class Dto {}',
  'widget/commands/create-widget/__tests__/create-widget.command-handler.spec.ts': '',
  'widget/queries/find-widgets/find-widgets.query.ts': 'export class FindWidgetsQuery {}',
  'widget/queries/find-widgets/find-widgets.query-handler.ts': 'export class Handler {}',
  'widget/queries/find-widgets/find-widgets.http.controller.ts': '  @Get()\nexport class C {}',
};

test('a module that follows the contract reports nothing', () => {
  const result = check(CONFORMING);
  assert.deepEqual(result.outstanding, []);
  assert.deepEqual(result.modules, ['widget']);
});

test('a module with no aggregate needs no domain/ or database/', () => {
  // The "no empty directories" half of the contract: a façade over an external
  // system is complete without the layers it has nothing to put in.
  const result = check({
    'gateway/gateway.module.ts': 'export class GatewayModule {}',
    'gateway/gateway.di-tokens.ts': "export const G = Symbol('G');",
    'gateway/infrastructure/gateway.port.ts': 'export interface GatewayPort {}',
    'gateway/infrastructure/remote.gateway.ts': 'export class RemoteGateway {}',
    'gateway/commands/sync/sync.command.ts': 'export class SyncCommand {}',
    'gateway/commands/sync/sync.command-handler.ts': 'export class SyncCommandHandler {}',
  });
  assert.deepEqual(result.outstanding, []);
});

test('the dissolved buckets each report their own kind', () => {
  for (const bucket of ['services', 'entities', 'utils', 'common', 'types', 'controllers']) {
    const result = check({ ...CONFORMING, [`widget/${bucket}/thing.ts`]: '' });
    assert.deepEqual(kinds(result), ['dissolved-directory'], bucket);
  }
});

test('a service or a controller at a module root is named as such', () => {
  assert.deepEqual(kinds(check({ ...CONFORMING, 'widget/widget.service.ts': '' })), [
    'service-at-module-root',
  ]);
  assert.deepEqual(kinds(check({ ...CONFORMING, 'widget/widget.controller.ts': 'class C {}' })), [
    'controller-at-module-root',
  ]);
});

test('a plural mappers file is rejected', () => {
  assert.deepEqual(kinds(check({ ...CONFORMING, 'widget/widget.mappers.ts': '' })), [
    'plural-mappers-file',
  ]);
});

test('a route outside a use-case controller is reported, a probe is not', () => {
  assert.deepEqual(
    kinds(check({ ...CONFORMING, 'widget/widget.resource.ts': '@Get()\nexport const R = {};' })),
    ['route-outside-slice'],
  );
  // `/health` and `/ready` are not use cases and do not owe a slice.
  assert.deepEqual(
    check({
      'health/health.module.ts': 'export class HealthModule {}',
      'health/probes/health.probe.controller.ts': '  @Get()\nexport class HealthProbe {}',
      'health/probes/redis.indicator.ts': 'export class RedisIndicator {}',
    }).outstanding,
    [],
  );
});

test('a slice is named after itself, and its message and handler come as a pair', () => {
  const base = { ...CONFORMING };
  delete base['widget/commands/create-widget/create-widget.command-handler.ts'];
  assert.deepEqual(kinds(check(base)), ['message-without-handler']);

  // A valid suffix on the wrong stem: the slice is `create-widget`, so
  // `create-thing.command.ts` is a file that belongs to no slice at all.
  const renamed = { ...CONFORMING };
  delete renamed['widget/commands/create-widget/create-widget.command.ts'];
  renamed['widget/commands/create-widget/create-thing.command.ts'] = '';
  assert.ok(kinds(check(renamed)).includes('file-not-named-after-slice'));
});

test('a command handler is not called .service.ts', () => {
  const swapped = { ...CONFORMING };
  delete swapped['widget/commands/create-widget/create-widget.command-handler.ts'];
  swapped['widget/commands/create-widget/create-widget.service.ts'] = '';
  assert.ok(kinds(check(swapped)).includes('file-not-in-slice-contract'));
});

test('an empty directory is a placeholder, not a layer', () => {
  const root = mkdtempSync(join(tmpdir(), 'oppenheimer-contract-'));
  roots.push(root);
  const src = join(root, 'src');
  for (const [path, contents] of Object.entries(CONFORMING)) {
    const full = join(src, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents ?? '');
  }
  mkdirSync(join(src, 'widget/application'), { recursive: true });
  assert.deepEqual(
    checkApiStructure(src, { root, ledger: [] }).outstanding.map((e) => e.kind),
    ['empty-directory'],
  );
});

test('a file the layer does not admit reports its kind, wherever it is', () => {
  assert.deepEqual(kinds(check({ ...CONFORMING, 'widget/domain/widget.repository.ts': '' })), [
    'file-name-not-admitted',
  ]);
  assert.deepEqual(kinds(check({ ...CONFORMING, 'widget/dtos/widget.request.dto.ts': '' })), [
    'file-name-not-admitted',
  ]);
});

test('the caps bite, and only on the file kind they name', () => {
  const long = (n) => `${'// x\n'.repeat(n)}export class C {}`;
  const over = { ...CONFORMING };
  over['widget/commands/create-widget/create-widget.http.controller.ts'] = long(120);
  assert.deepEqual(kinds(check(over)), ['controller-over-cap']);

  const handler = { ...CONFORMING };
  handler['widget/commands/create-widget/create-widget.command-handler.ts'] = long(130);
  assert.deepEqual(kinds(check(handler)), ['handler-over-cap']);
});

test('an ORM entity declares a date only through the shared decorators', () => {
  const entity = (body) => ({ ...CONFORMING, 'widget/database/widget.orm-entity.ts': body });
  for (const bare of [
    "import { CreateDateColumn } from 'typeorm';\n@CreateDateColumn()\ncreatedAt!: Date;",
    "import { UpdateDateColumn } from 'typeorm';\n@UpdateDateColumn()\nupdatedAt!: Date;",
    "@Column({ type: 'timestamp', nullable: true })\nstoppedAt!: Date | null;",
    "@Column({ nullable: true, type: 'timestamptz' })\nstoppedAt!: Date | null;",
    "@Column({ type: 'timestamp with time zone' })\nexpiresAt!: Date;",
  ]) {
    assert.deepEqual(kinds(check(entity(bare))), ['bare-date-column'], bare);
  }
  const shared = [
    "import { CreatedAtColumn, TimestampColumn } from '@oppenheimer/backend-ddd';",
    '@TimestampColumn({ nullable: true })\nstoppedAt!: Date | null;',
    '@CreatedAtColumn()\ncreatedAt!: Date;',
  ].join('\n');
  assert.deepEqual(kinds(check(entity(shared))), []);
  // The rule is about persistence models; a domain entity may say "timestamp".
  const domain = { ...CONFORMING, 'widget/domain/widget.entity.ts': "// type: 'timestamp'" };
  assert.deepEqual(kinds(check(domain)), []);
});

test('a ledger entry silences exactly its own (path, kind), and nothing else', () => {
  const broken = { ...CONFORMING, 'widget/widget.service.ts': '' };
  const ledger = [{ path: 'src/widget/widget.service.ts', kind: 'service-at-module-root' }];
  assert.deepEqual(check(broken, { ledger }).outstanding, []);

  // A different kind at the same path is still reported.
  assert.deepEqual(
    kinds(check({ ...broken, 'widget/widget.controller.ts': 'class C {}' }, { ledger })),
    ['controller-at-module-root'],
  );
});

test('a ledger entry that no longer matches is itself an error', () => {
  const ledger = [{ path: 'src/widget/gone.service.ts', kind: 'service-at-module-root' }];
  assert.deepEqual(kinds(check(CONFORMING, { ledger })), ['stale-ledger-entry']);
});

test("the repository's own ledger is current", async () => {
  // The real run, with the real ledger: this is what CI asserts, and it fails
  // both on a new violation and on an entry whose debt has been paid.
  const { checkApiStructure: run, LEDGER } = await import('./check-api-structure.mjs');
  const apiSrc = fileURLToPath(new URL('../apps/api/src', import.meta.url));
  const result = run(apiSrc, { ledger: LEDGER });
  assert.deepEqual(
    result.outstanding.map((e) => e.message),
    [],
  );
});
