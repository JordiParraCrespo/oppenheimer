#!/usr/bin/env node
/**
 * One installed copy of every React singleton, read from the lockfile.
 *
 * A library that keeps module state — a React context, a store, an i18n
 * instance — breaks when the bundle holds two copies of it: one package
 * registers on its copy, another reads from the other. pnpm makes one copy
 * per *resolved snapshot*, and a snapshot is a version plus the peers it
 * resolved against, so the same version can install twice:
 *
 *   react-i18next@17.0.14(i18next@26.4.2(typescript@6.0.3))…
 *   react-i18next@17.0.14(i18next@26.4.2(typescript@7.0.2))…
 *
 * That is the incident behind #274: `i18next` declares TypeScript as a peer,
 * `packages/frontend/core` compiled with TypeScript 6 while the app used 7,
 * and the production image (a filtered `pnpm install --filter
 * @oppenheimer/web...`) bundled two `react-i18next` and two `i18next`. A full
 * local install happened to bundle one, so nothing caught it. The lockfile
 * held both variants either way, so this checks the lockfile: no install, no
 * Docker, milliseconds.
 *
 * The list is `singletons` in the root `package.json`, beside
 * `pnpm.overrides` (which pins most of them): `importers` are the projects
 * whose closure is walked (workspace `link:`s are followed, so a package the
 * app imports counts), `packages` the names that must resolve to a single
 * snapshot in it. Run: pnpm check:singletons
 *
 *   node scripts/check-singletons.mjs                     # the checked-out lockfile
 *   node scripts/check-singletons.mjs --lockfile <path>   # another one, e.g. an older revision's
 */
import { readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath`, not `.pathname`, for a checkout path with a space: see check-api-structure.mjs.
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');

const DEPENDENCY_GROUPS = new Set(['dependencies', 'devDependencies', 'optionalDependencies']);

const unquote = (text) =>
  text
    .trim()
    .replace(/^'(.*)'$/, '$1')
    .replace(/^"(.*)"$/, '$1');

/** `@scope/name@1.0.0(peer@2)` → `@scope/name`. */
export function packageName(snapshotKey) {
  const at = snapshotKey.indexOf('@', 1);
  return at === -1 ? snapshotKey : snapshotKey.slice(0, at);
}

/**
 * The two sections of a v9 `pnpm-lock.yaml` this check reads, without a YAML
 * dependency: pnpm writes them in a fixed shape (two-space indent, one
 * mapping per line), and that shape is all this parses.
 *
 *   importers  path → [{ name, version }] across every dependency group
 *   snapshots  key  → [{ name, version }] across dependencies and optionalDependencies
 */
export function parseLockfile(text) {
  const importers = new Map();
  const snapshots = new Map();
  let section = null;
  let owner = null; // the importer or snapshot being read
  let inGroup = false;
  let pendingName = null; // an importer dependency waiting for its `version:`

  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const body = line.trim();

    if (indent === 0) {
      section = body.replace(/:.*$/, '');
      owner = null;
      continue;
    }
    if (section !== 'importers' && section !== 'snapshots') continue;
    const target = section === 'importers' ? importers : snapshots;

    if (indent === 2) {
      // `  key:` or `  key: {}` — the key may contain colons only inside quotes.
      const key = unquote(body.replace(/:( \{\})?$/, ''));
      owner = [];
      target.set(key, owner);
      inGroup = false;
      continue;
    }
    if (!owner) continue;
    if (indent === 4) {
      inGroup = DEPENDENCY_GROUPS.has(body.replace(/:.*$/, ''));
      if (section === 'snapshots' && body.startsWith('devDependencies')) inGroup = false;
      continue;
    }
    if (!inGroup) continue;

    if (section === 'snapshots' && indent === 6) {
      const split = body.search(/: /);
      if (split === -1) continue;
      owner.push({ name: unquote(body.slice(0, split)), version: unquote(body.slice(split + 2)) });
    } else if (section === 'importers' && indent === 6) {
      pendingName = unquote(body.replace(/:$/, ''));
    } else if (section === 'importers' && indent === 8 && body.startsWith('version: ')) {
      owner.push({ name: pendingName, version: unquote(body.slice('version: '.length)) });
    }
  }
  return { importers, snapshots };
}

/**
 * The snapshot a dependency entry points at. An alias (`string-width-cjs:
 * string-width@4.2.3`) names its target in the version; everything else is
 * `<name>@<version>`.
 */
function snapshotKeyOf({ name, version }, snapshots) {
  const direct = `${name}@${version}`;
  if (snapshots.has(direct)) return direct;
  if (snapshots.has(version)) return version;
  return direct;
}

/**
 * Every singleton resolved to more than one snapshot in the closure of
 * `importers`. Pure, so the test can hand it any lockfile text.
 *
 * Returns [{ name, variants: [{ key, via }] }], where `via` is one chain of
 * importers and snapshots that reaches the variant, for the error message.
 */
export function findDuplicateSingletons({ lockfile, importers, singletons }) {
  const { importers: projects, snapshots } = parseLockfile(lockfile);
  const wanted = new Set(singletons);
  const seen = new Map(); // node id → the chain that reached it
  const queue = [];

  for (const importer of importers) {
    if (!projects.has(importer)) {
      throw new Error(`importer "${importer}" is not in pnpm-lock.yaml`);
    }
    const id = `importer:${importer}`;
    seen.set(id, [importer]);
    queue.push({ id, importer });
  }

  const found = new Map(); // singleton name → Map(snapshot key → via)

  while (queue.length > 0) {
    const node = queue.shift();
    const via = seen.get(node.id);
    const edges =
      node.importer !== undefined ? projects.get(node.importer) : snapshots.get(node.key);

    for (const edge of edges ?? []) {
      if (edge.version.startsWith('link:')) {
        if (node.importer === undefined) continue; // a snapshot's link points outside the workspace graph
        const importer = normalize(join(node.importer, edge.version.slice('link:'.length)));
        const id = `importer:${importer}`;
        if (!projects.has(importer) || seen.has(id)) continue;
        seen.set(id, [...via, importer]);
        queue.push({ id, importer });
        continue;
      }
      const key = snapshotKeyOf(edge, snapshots);
      const id = `snapshot:${key}`;
      if (seen.has(id)) continue;
      const chain = [...via, key];
      seen.set(id, chain);
      queue.push({ id, key });

      const name = packageName(key);
      if (wanted.has(name)) {
        if (!found.has(name)) found.set(name, new Map());
        found.get(name).set(key, chain);
      }
    }
  }

  return [...found]
    .filter(([, variants]) => variants.size > 1)
    .map(([name, variants]) => ({
      name,
      variants: [...variants].map(([key, via]) => ({ key, via })),
    }));
}

function main() {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const config = manifest.singletons;
  if (!config?.importers?.length || !config?.packages?.length) {
    console.error(
      'check:singletons: `singletons.importers` and `singletons.packages` in package.json are required.',
    );
    process.exit(2);
  }
  const at = process.argv.indexOf('--lockfile');
  const lockfilePath = at === -1 ? join(root, 'pnpm-lock.yaml') : process.argv[at + 1];
  const lockfile = readFileSync(lockfilePath, 'utf8');
  const duplicates = findDuplicateSingletons({
    lockfile,
    importers: config.importers,
    singletons: config.packages,
  });

  if (duplicates.length === 0) {
    console.log(
      `check:singletons: ${config.packages.length} singleton(s) resolve once each from ${config.importers.join(', ')}.`,
    );
    return;
  }
  for (const { name, variants } of duplicates) {
    console.error(`\n${name} resolves to ${variants.length} installed copies:`);
    for (const { key, via } of variants) {
      console.error(`  ${key}\n    via ${via.slice(0, -1).join(' → ')}`);
    }
  }
  console.error(
    '\nEach copy is a separate module instance in the bundle. Align what differs in the peer suffix ' +
      '(often a devDependency such as typescript, or a peer range) across the packages above, ' +
      'or pin the package in package.json#pnpm.overrides, then run pnpm install.',
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) main();
