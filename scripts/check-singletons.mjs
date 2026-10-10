#!/usr/bin/env node
/**
 * Every package a project lists as a singleton resolves to exactly one
 * snapshot in that project's closure of pnpm-lock.yaml.
 *
 * A library that keeps module state (a React context, a store, an i18n
 * instance) breaks when the bundle holds two copies of it. pnpm installs one
 * copy per resolved snapshot, a version plus the peers it resolved against,
 * so one version can install twice under two peer suffixes. The list is
 * `singletons` in the project's own package.json (`apps/web`); the closure
 * follows workspace `link:`s, so a package the app imports counts. A listed
 * name the closure never reaches fails too: a check that cannot see a
 * package proves nothing about it.
 *
 *   node scripts/check-singletons.mjs                     # the checked-out lockfile
 *   node scripts/check-singletons.mjs --lockfile <path>   # another one, e.g. an older revision's
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath`, not `.pathname`, for a checkout path with a space: see check-api-structure.mjs.
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');

/** `@scope/name@1.0.0(peer@2)` → `@scope/name`. */
export function packageName(snapshotKey) {
  const at = snapshotKey.indexOf('@', 1);
  return at === -1 ? snapshotKey : snapshotKey.slice(0, at);
}

// A YAML scalar as pnpm writes one in these two sections: single-quoted (a
// doubled quote escapes one) or plain, with no spaces. Anything else, a block
// scalar, a flow map, a double-quoted string, is a shape this does not read.
const SCALAR = String.raw`'(?:[^']|'')*'|[^\s'"{}[\]|>&*!#][^\s]*`;
const scalar = (text) => (text.startsWith("'") ? text.slice(1, -1).replaceAll("''", "'") : text);
const line = (pattern) => new RegExp(`^${pattern}$`);
const KEY = line(`(${SCALAR}):( \\{\\})?`);
const ENTRY = line(`(${SCALAR}): (${SCALAR})`);
const ITEM = line(`- (${SCALAR})`);

const IMPORTER_GROUPS = new Set(['dependencies', 'devDependencies', 'optionalDependencies']);
const SNAPSHOT_GROUPS = new Set(['dependencies', 'optionalDependencies']);

/**
 * The `importers` and `snapshots` sections of a v9 pnpm-lock.yaml, as data:
 *
 *   importers  path → [{ name, version }] across every dependency group
 *   snapshots  key  → [{ name, version }] across dependencies and optionalDependencies
 *
 * pnpm writes both sections in one fixed shape, and this reads only that
 * shape: a line it does not recognise throws, with its number, rather than
 * being skipped. The other sections are not read.
 */
export function parseLockfile(text) {
  const importers = new Map();
  const snapshots = new Map();
  let section = null;
  let owner = null; // the importer's or snapshot's edges
  let group = null; // the group under the owner, or null
  let pending = null; // an importer dependency waiting for its `version:`

  text.split('\n').forEach((raw, index) => {
    const fail = (why) => {
      throw new Error(`pnpm-lock.yaml:${index + 1}: ${why}: ${JSON.stringify(raw)}`);
    };
    if (raw.trim() === '') return;
    const indent = raw.length - raw.trimStart().length;
    const body = raw.trim();

    if (indent === 0) {
      section = body.replace(/:.*$/, '');
      owner = null;
      return;
    }
    if (section !== 'importers' && section !== 'snapshots') return;
    const match = (pattern) => body.match(pattern) ?? fail(`not a line ${section} has`);

    if (indent === 2) {
      const [, key] = match(KEY);
      owner = [];
      group = null;
      (section === 'importers' ? importers : snapshots).set(scalar(key), owner);
      return;
    }
    if (!owner) fail('an entry outside any importer or snapshot');

    if (indent === 4) {
      if (section === 'snapshots' && body === 'optional: true') {
        group = null;
        return;
      }
      const [, key, empty] = match(KEY);
      const name = scalar(key);
      const known =
        section === 'importers'
          ? IMPORTER_GROUPS.has(name)
          : SNAPSHOT_GROUPS.has(name) || name === 'transitivePeerDependencies';
      if (!known || empty) fail(`an unknown field under a ${section.slice(0, -1)}`);
      group = name;
      return;
    }
    if (!group) fail('an entry outside a dependency group');

    if (section === 'importers') {
      if (indent === 6) {
        pending = scalar(match(KEY)[1]);
      } else if (indent === 8) {
        const [, field, value] = match(ENTRY);
        if (field === 'version') owner.push({ name: pending, version: scalar(value) });
        else if (field !== 'specifier') fail('an unknown field under an importer dependency');
      } else {
        fail('an unexpected indent');
      }
      return;
    }
    if (indent !== 6) fail('an unexpected indent');
    if (group === 'transitivePeerDependencies') {
      match(ITEM);
      return;
    }
    const [, name, version] = match(ENTRY);
    owner.push({ name: scalar(name), version: scalar(version) });
  });
  return { importers, snapshots };
}

/**
 * The snapshot a dependency entry points at. An alias (`string-width-cjs:
 * string-width@4.2.3`) names its target in the version; everything else is
 * `<name>@<version>`. A key the lockfile does not hold is an error.
 */
function snapshotKeyOf({ name, version }, snapshots) {
  const direct = `${name}@${version}`;
  if (snapshots.has(direct)) return direct;
  if (snapshots.has(version)) return version;
  throw new Error(`no snapshot for ${name}: ${version} in pnpm-lock.yaml`);
}

/**
 * Every listed singleton of `importer`, with each snapshot of it that the
 * importer's closure reaches. Pure, so the test can hand it any lockfile text.
 *
 * Returns [{ name, variants: [{ key, via }] }], one entry per listed name in
 * list order, where `via` is one chain of importers and snapshots that
 * reaches the variant. A clean result has exactly one variant per name.
 */
export function resolveSingletons({ lockfile, importer, singletons }) {
  const { importers: projects, snapshots } = parseLockfile(lockfile);
  if (!projects.has(importer)) throw new Error(`importer "${importer}" is not in pnpm-lock.yaml`);

  const found = new Map(singletons.map((name) => [name, new Map()]));
  const seen = new Map([[`importer:${importer}`, [importer]]]);
  const queue = [{ id: `importer:${importer}`, importer }];

  while (queue.length > 0) {
    const node = queue.shift();
    const via = seen.get(node.id);
    const edges =
      node.importer !== undefined ? projects.get(node.importer) : snapshots.get(node.key);

    for (const edge of edges) {
      if (edge.version.startsWith('link:')) {
        if (node.importer === undefined) continue; // a snapshot's link points outside the workspace graph
        // Lockfile paths are posix on every platform.
        const target = posix.normalize(
          posix.join(node.importer, edge.version.slice('link:'.length)),
        );
        const id = `importer:${target}`;
        if (!projects.has(target) || seen.has(id)) continue;
        seen.set(id, [...via, target]);
        queue.push({ id, importer: target });
        continue;
      }
      const key = snapshotKeyOf(edge, snapshots);
      const id = `snapshot:${key}`;
      if (seen.has(id)) continue;
      const chain = [...via, key];
      seen.set(id, chain);
      queue.push({ id, key });
      found.get(packageName(key))?.set(key, chain);
    }
  }

  return [...found].map(([name, variants]) => ({
    name,
    variants: [...variants].map(([key, chain]) => ({ key, via: chain })),
  }));
}

/** Every importer of the lockfile whose package.json lists singletons. */
function listedImporters(lockfile) {
  const { importers } = parseLockfile(lockfile);
  return [...importers.keys()].flatMap((importer) => {
    const manifest = join(root, importer, 'package.json');
    if (!existsSync(manifest)) return [];
    const { singletons } = JSON.parse(readFileSync(manifest, 'utf8'));
    return singletons ? [{ importer, singletons }] : [];
  });
}

function main() {
  const at = process.argv.indexOf('--lockfile');
  const lockfile = readFileSync(
    at === -1 ? join(root, 'pnpm-lock.yaml') : process.argv[at + 1],
    'utf8',
  );
  const listed = listedImporters(lockfile);
  if (listed.length === 0) {
    console.error('check:singletons: no workspace package.json lists `singletons`.');
    process.exit(2);
  }

  let failed = false;
  for (const { importer, singletons } of listed) {
    for (const { name, variants } of resolveSingletons({ lockfile, importer, singletons })) {
      if (variants.length === 1) {
        console.log(`${importer}: ${variants[0].key}`);
        continue;
      }
      failed = true;
      if (variants.length === 0) {
        console.error(
          `\n${importer}: ${name} is listed as a singleton, but nothing it uses installs it.`,
        );
        continue;
      }
      console.error(`\n${importer}: ${name} resolves to ${variants.length} installed copies:`);
      for (const { key, via } of variants) {
        console.error(`  ${key}\n    via ${via.slice(0, -1).join(' → ')}`);
      }
    }
  }
  if (!failed) return;
  console.error(
    '\nEach copy is a separate module instance in the bundle. Align what differs in the peer ' +
      'suffix (often a devDependency such as typescript, or a peer range) across the packages ' +
      'above, then run pnpm install. A name nothing installs is a typo or a stale entry in ' +
      '`singletons`.',
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) main();
