#!/usr/bin/env node
/**
 * The frontend layout contract, checked. Everything here is a rule that broke
 * in a project built from this starter once it was left to prose:
 *
 *  - a feature is named after a module of the kernel or of the app's product
 *    package (or is on the app's short allowlist), never after a screen
 *  - a feature holds only the kind directories, and a kind directory holds
 *    files, never a sub-directory
 *  - a route file composes; past 120 lines it contains
 *  - an app never re-creates a file the platform kit already ships
 *  - every workspace package carries a README.md and an AGENTS.md, every
 *    frontend app and package an ARCHITECTURE.md, and every AGENTS.md points
 *    at a rule file
 *
 * See .agents/rules/frontend-architecture.md. Run: pnpm check:structure
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath`, not `new URL(...).pathname`: a pathname is URL-encoded, so a
// checkout under a directory with a space in it resolves to `/Macintosh%20SSD/...`
// and every `readdirSync` below it fails — or, worse, still relativises, and the
// paths silently match nothing they are compared against.
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const errors = [];
const fail = (message) => errors.push(message);

const KINDS = [
  'screens',
  'sections',
  'dialogs',
  'forms',
  'components',
  'hooks',
  'lib',
  '__tests__',
];
const ROUTE_LINE_CAP = 120;
/** What an app keeps beside its routes and features: configuration, nothing else. */
const APP_CONFIG_FILES = ['oppenheimer.ts', 'auth-client.ts', 'nav.ts', 'query.ts'];

const modulesOf = (pkg) => {
  const dir = join(root, 'packages/frontend', pkg, 'src/modules');
  // `core` is the kernel's own wiring (errors, storage), not something a feature renders.
  return existsSync(dir)
    ? readdirSync(dir).filter((n) => n !== 'core' && statSync(join(dir, n)).isDirectory())
    : [];
};
const kernel = modulesOf('core');

/** Each frontend app: where its routes and features are, which product it is, what else it may name. */
const APPS = [
  // oppenheimer:begin web
  {
    app: 'apps/web',
    routes: 'src/routes',
    features: 'src/features',
    product: 'consumer',
    allow: ['public'],
    kit: 'web',
  },
  // oppenheimer:end web
];
/** The platform kits, documented like the apps they serve. */
const KITS = [
  // oppenheimer:begin web
  'packages/frontend/web',
  // oppenheimer:end web
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const kitBasenames = (kit) => {
  const dir = join(root, 'packages/frontend', kit, 'src');
  const names = new Set();
  if (!existsSync(dir)) return names;
  for (const file of walk(dir)) {
    const base = file.split('/').pop();
    if (/\.(spec|test)\.tsx?$/.test(base) || base === 'index.ts' || base.endsWith('.d.ts'))
      continue;
    if (/\.tsx?$/.test(base)) names.add(base);
  }
  return names;
};

/**
 * One render-topology check: a query belongs where its result is drawn.
 *
 * Everything above this point is about where a file sits. This is about what a
 * component *does*, and it is the only such rule worth a source scan — the
 * mistake it catches (subscribe on the page, thread the result down) is a
 * placement mistake wearing a hook, and placement is what this script reads.
 *
 * What a component *costs* is not checked here. It was, briefly, as a line cap
 * per kind; a cap is a formatter, not a model — a section that still owns the
 * query, the column factory, six dialogs and the row menu passes it at 149
 * lines, and the pressure it creates is to shard files rather than to name the
 * jobs. The `*-render.spec.tsx` files, with the React Compiler off, are the
 * check for cost. See .agents/rules/frontend-architecture.md.
 *
 * This scan is deliberately narrow and easy to walk around: it reads named
 * imports from a product package's React entrypoint and a single local JSX
 * consumer, so two dummy readers, a default import, a query hook re-exported by
 * the kit, or a `Map` that arrived as a prop all pass it. It is a tripwire on
 * the shape that actually recurred, not a proof.
 */

/** What a React Query result exposes. Reading any of these makes a value derived from it. */
const QUERY_FIELDS = ['data', 'isLoading', 'isFetching', 'isPending', 'isError', 'error', 'status'];

/**
 * The JSX opening tag for `<Name`, from the character after the name to the `>`
 * that closes it.
 *
 * Scanned rather than matched because a prop value holds arrows and generics —
 * `onCreated={(secret) => setSecret(secret)}` has two `>` in it, and a regex
 * stopping at the first one reads half a tag.
 */
function openingTag(source, from) {
  let depth = 0;
  for (let i = from; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === '>' && depth === 0) return source.slice(from, i);
    else if (char === '<' && depth === 0 && i > from) return source.slice(from, i);
  }
  return '';
}

/** Every `<Name` in `source`, with the text of its opening tag. */
function jsxUsages(source, name) {
  const tags = [];
  const pattern = new RegExp(`<${name}\\b`, 'g');
  let match = pattern.exec(source);
  while (match !== null) {
    tags.push(openingTag(source, match.index + match[0].length));
    match = pattern.exec(source);
  }
  return tags;
}

/** The names a file imports from a product package's React entrypoint — its query and mutation hooks. */
function queryHooksOf(source) {
  const names = new Set();
  const pattern = /import\s*{([^}]*)}\s*from\s*'@oppenheimer\/frontend-[a-z-]+\/react'/g;
  let match = pattern.exec(source);
  while (match !== null) {
    for (const part of match[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
    match = pattern.exec(source);
  }
  return names;
}

/**
 * The components a file imports from elsewhere in its own feature tree, each
 * with the kind directory it came from.
 *
 * The kind is what decides whether handing it a query result is a mistake:
 * `forms/` and `components/` are forbidden to fetch, so the section above them
 * *must* pass the pending flag and the error down. A `sections/`, `dialogs/` or
 * `screens/` sibling has no such excuse.
 */
function featureComponentsOf(source) {
  const byName = new Map();
  const pattern =
    /import\s*(?:type\s*)?{([^}]*)}\s*from\s*'[^']*features\/[^'/]+\/([a-z_]+)\/[^']*'/g;
  let match = pattern.exec(source);
  while (match !== null) {
    for (const part of match[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && /^[A-Z]/.test(name)) byName.set(name, match[2]);
    }
    match = pattern.exec(source);
  }
  return byName;
}

/**
 * The identifiers in `source` that hold a query result, or something read out of
 * one. Two passes, so `const rows = roles.data?.data ?? []` counts as derived.
 */
function queryBindingsOf(source, hooks) {
  const bound = new Set();
  for (const hook of hooks) {
    const pattern = new RegExp(
      `\\b(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${hook}\\s*\\(`,
      'g',
    );
    let match = pattern.exec(source);
    while (match !== null) {
      bound.add(match[1]);
      match = pattern.exec(source);
    }
  }
  for (let pass = 0; pass < 2; pass += 1) {
    for (const name of [...bound]) {
      const pattern = new RegExp(
        `\\b(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${name}[.?]`,
        'g',
      );
      let match = pattern.exec(source);
      while (match !== null) {
        bound.add(match[1]);
        match = pattern.exec(source);
      }
    }
  }
  return bound;
}

/**
 * A query result may not be handed down to its only consumer.
 *
 * Passing one page of rows to `DataTable` is the intended flow — the kit is
 * where data is rendered — and so is handing a mutation's pending flag to a
 * `forms/` child, which is forbidden to fetch. What this catches is narrower:
 * a screen that subscribes to a query so that exactly one sibling below it can
 * render the result. That sibling can call the hook itself, and until it does,
 * every settle of that query re-renders everything else on the page.
 *
 * `api-tokens.tsx` held `usePermissionCatalog()` for `CreateTokenCard` alone,
 * which forwarded all three of its props to the form below it and read none.
 * Two siblings genuinely sharing one result is a different thing and passes:
 * `profile.tsx` fetches the profile once for its hero and its details pane.
 */
const FETCHING_KINDS = new Set(['screens', 'sections', 'dialogs']);

function checkQueryStaysHome(source, label) {
  const hooks = queryHooksOf(source);
  if (hooks.size === 0) return;
  const locals = featureComponentsOf(source);
  if (locals.size === 0) return;
  const bindings = queryBindingsOf(source, hooks);
  if (bindings.size === 0) return;

  /** binding -> the components below that read it, by name. */
  const consumers = new Map();
  for (const [component, kind] of locals) {
    for (const tag of jsxUsages(source, component)) {
      for (const binding of bindings) {
        const reads =
          new RegExp(`\\b${binding}\\s*[.?]\\s*(?:${QUERY_FIELDS.join('|')})\\b`).test(tag) ||
          new RegExp(`=\\s*{\\s*${binding}\\s*}`).test(tag);
        if (!reads) continue;
        if (!consumers.has(binding)) consumers.set(binding, new Map());
        consumers.get(binding).set(component, kind);
      }
    }
  }

  for (const [binding, readers] of consumers) {
    if (readers.size !== 1) continue;
    const [component, kind] = [...readers][0];
    if (!FETCHING_KINDS.has(kind)) continue;
    fail(
      `${label}: subscribes to \`${binding}\` only to hand it to <${component} /> (${kind}/), its one consumer. A ${kind.replace(/s$/, '')} may fetch — let it call the hook, so a settle of this query stops re-rendering everything beside it. See .agents/rules/frontend-architecture.md`,
    );
  }
}

for (const { app, routes, features, product, allow, kit } of APPS) {
  const appDir = join(root, app);
  if (!existsSync(appDir)) continue;
  const allowed = new Set([...kernel, ...modulesOf(product), ...allow]);

  // features: names, kinds, flatness
  const featuresDir = join(appDir, features);
  if (existsSync(featuresDir)) {
    for (const name of readdirSync(featuresDir)) {
      const featureDir = join(featuresDir, name);
      if (!statSync(featureDir).isDirectory()) {
        fail(
          `${app}/${features}/${name}: a feature is a directory named after a module; loose files do not belong here`,
        );
        continue;
      }
      if (!allowed.has(name)) {
        fail(
          `${app}/${features}/${name}: not a module of @oppenheimer/frontend-core or @oppenheimer/frontend-${product}, and not on the app's allowlist (${[...allow].join(', ') || 'none'})`,
        );
      }
      for (const kind of readdirSync(featureDir)) {
        const kindDir = join(featureDir, kind);
        if (!statSync(kindDir).isDirectory()) {
          fail(
            `${app}/${features}/${name}/${kind}: a feature holds kind directories (${KINDS.join(', ')}), not files`,
          );
          continue;
        }
        if (!KINDS.includes(kind)) {
          fail(`${app}/${features}/${name}/${kind}: not a kind directory (${KINDS.join(', ')})`);
          continue;
        }
        for (const entry of readdirSync(kindDir, { withFileTypes: true })) {
          if (entry.isFile() && /\.tsx$/.test(entry.name) && !/\.spec\.tsx$/.test(entry.name)) {
            const file = join(kindDir, entry.name);
            const source = readFileSync(file, 'utf8');
            const label = `${app}/${features}/${name}/${kind}/${entry.name}`;
            checkQueryStaysHome(source, label);
          }
          if (entry.isDirectory() && kind !== '__tests__') {
            fail(
              `${app}/${features}/${name}/${kind}/${entry.name}: a kind directory holds files, never a sub-directory — a feature that wants one is two features`,
            );
          }
          if (entry.isFile() && entry.name === 'index.ts') {
            fail(
              `${app}/${features}/${name}/${kind}/index.ts: no barrels inside a feature; a route imports the screen by its path`,
            );
          }
        }
      }
    }
  }

  // routes: the line cap
  const routesDir = join(appDir, routes);
  if (existsSync(routesDir)) {
    for (const file of walk(routesDir)) {
      if (!/\.tsx?$/.test(file) || file.endsWith('.gen.ts')) continue;
      const lines = readFileSync(file, 'utf8').split('\n').length;
      if (lines > ROUTE_LINE_CAP) {
        fail(
          `${relative(root, file)}: ${lines} lines; a route file composes (cap ${ROUTE_LINE_CAP}). Move the body into ${features}/<module>/screens/`,
        );
      }
    }
  }

  // the app's lib/ is configuration: the DI container, the auth client, the
  // nav, the query client. A helper there is a helper the kit should ship.
  const libDir = join(appDir, routes === 'app' ? 'lib' : 'src/lib');
  if (existsSync(libDir)) {
    for (const file of walk(libDir)) {
      const base = file.split('/').pop();
      if (!APP_CONFIG_FILES.includes(base)) {
        fail(
          `${relative(root, file)}: an app's lib/ holds only ${APP_CONFIG_FILES.join(', ')}. A helper two screens use belongs in the platform kit; one screen's belongs in its feature's lib/`,
        );
      }
    }
  }

  // no second copy of something the kit ships
  const shipped = kitBasenames(kit);
  for (const sub of [features, 'src/components', 'components']) {
    const dir = join(appDir, sub);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const base = file.split('/').pop();
      if (shipped.has(base)) {
        fail(
          `${relative(root, file)}: @oppenheimer/frontend-${kit} already ships ${base}; import it from the kit instead of keeping a copy`,
        );
      }
    }
  }

  // components/ at the app root is the pre-features layout
  for (const legacy of ['src/components', 'components']) {
    if (existsSync(join(appDir, legacy)))
      fail(
        `${app}/${legacy}: components live in ${features}/<module>/<kind>/ or in the platform kit, not at the app root`,
      );
  }
}

// docs: every workspace package documented, frontend surfaces with an ARCHITECTURE.md
const workspacePackages = [];
const PACKAGE_ROOTS = [
  'apps',
  'packages',
  'packages/backend',
  'packages/frontend/design-system',
  'packages/frontend',
  // oppenheimer:begin runner
  'packages/go',
  // oppenheimer:end runner
];
for (const base of PACKAGE_ROOTS) {
  const dir = join(root, base);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    const pkgDir = join(dir, name);
    if (statSync(pkgDir).isDirectory() && existsSync(join(pkgDir, 'package.json')))
      workspacePackages.push(relative(root, pkgDir));
  }
}
for (const pkg of workspacePackages) {
  for (const doc of ['README.md', 'AGENTS.md']) {
    if (!existsSync(join(root, pkg, doc)))
      fail(`${pkg}: missing ${doc} — every workspace package carries one`);
  }
  const agents = join(root, pkg, 'AGENTS.md');
  if (existsSync(agents) && !/\.agents\/rules\/[a-z-]+\.md/.test(readFileSync(agents, 'utf8'))) {
    fail(
      `${pkg}/AGENTS.md: links no rule file under .agents/rules/ — an AGENTS.md is a map to the rules, not a copy of them`,
    );
  }
}
for (const surface of [...APPS.map(({ app }) => app), 'packages/frontend', ...KITS]) {
  if (existsSync(join(root, surface)) && !existsSync(join(root, surface, 'ARCHITECTURE.md'))) {
    fail(`${surface}: missing ARCHITECTURE.md — the layer model and the cookbook live there`);
  }
}

if (errors.length > 0) {
  console.error(`Frontend structure: ${errors.length} problem${errors.length === 1 ? '' : 's'}\n`);
  for (const error of errors) console.error(`  ✖ ${error}`);
  console.error('\nSee .agents/rules/frontend-architecture.md');
  process.exit(1);
}
console.log(
  `Frontend structure: ${APPS.length} apps and ${workspacePackages.length} packages conform.`,
);
