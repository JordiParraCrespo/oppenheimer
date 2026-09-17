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

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
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
    allow: ['sessions', 'hosts', 'public'],
    kit: 'web',
  },
  // oppenheimer:end web
  // oppenheimer:begin admin-web
  {
    app: 'apps/admin-web',
    routes: 'src/routes',
    features: 'src/features',
    product: 'admin',
    allow: [],
    kit: 'web',
  },
  // oppenheimer:end admin-web
  // oppenheimer:begin mobile
  {
    app: 'apps/mobile',
    routes: 'app',
    features: 'features',
    product: 'consumer',
    allow: ['dashboard'],
    kit: 'mobile',
  },
  // oppenheimer:end mobile
  // oppenheimer:begin admin-mobile
  {
    app: 'apps/admin-mobile',
    routes: 'app',
    features: 'features',
    product: 'admin',
    allow: [],
    kit: 'mobile',
  },
  // oppenheimer:end admin-mobile
];
/** The platform kits, documented like the apps they serve. */
const KITS = [
  // oppenheimer:begin web|admin-web
  'packages/frontend/web',
  // oppenheimer:end web|admin-web
  // oppenheimer:begin mobile|admin-mobile
  'packages/frontend/mobile',
  // oppenheimer:end mobile|admin-mobile
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
