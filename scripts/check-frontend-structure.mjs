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
 *  - the console's ground and page frame are the shell's: no screen paints
 *    the ground, draws `EditorPage` or rebuilds the frame by hand
 *  - an app never re-creates a file the platform kit already ships
 *  - every workspace package carries a README.md and an AGENTS.md, every
 *    frontend app, `packages/frontend` and each platform kit an
 *    ARCHITECTURE.md, and every AGENTS.md points at a rule file
 *
 * See .agents/rules/frontend-architecture.md. Run: pnpm check:structure
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath`, not `.pathname`, for a checkout path with a space: see check-api-structure.mjs.
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
/**
 * What an app keeps beside its routes and features: configuration, nothing
 * else. `console.ts` names the console's dialogs and lists, which the kit's
 * generic dialog slot and every feature that opens one share.
 */
const APP_CONFIG_FILES = ['oppenheimer.ts', 'auth-client.ts', 'nav.ts', 'query.ts', 'console.ts'];

const modulesOf = (pkg) => {
  const dir = join(root, 'packages/frontend', pkg, 'src/modules');
  // `core` is the kernel's own wiring (errors, storage), not something a feature renders.
  return existsSync(dir)
    ? readdirSync(dir).filter((n) => n !== 'core' && statSync(join(dir, n)).isDirectory())
    : [];
};
const kernel = modulesOf('core');

const APPS = [
  // oppenheimer:begin web
  {
    app: 'apps/web',
    routes: 'src/routes',
    features: 'src/features',
    product: 'consumer',
    // `public`: pages that render no entity.
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
 * One render-topology check: a query belongs where its result is drawn. The
 * mistake it catches (subscribe on the page, thread the result down) is a
 * placement mistake wearing a hook, and placement is what this script reads.
 *
 * What a component *costs* is not checked here: a line cap per kind pushes
 * people to shard files rather than name the jobs. The `*-render.spec.tsx`
 * files, with the React Compiler off, are the check for cost
 * (.agents/rules/frontend-architecture.md).
 *
 * The scan is deliberately narrow: it reads named imports from a product
 * package's React entrypoint and a single local JSX consumer, so a default
 * import, a hook re-exported by the kit or a `Map` that arrived as a prop all
 * pass it. It is a tripwire on the shape that actually recurred, not a proof.
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

const FETCHING_KINDS = new Set(['screens', 'sections', 'dialogs']);

/**
 * A query result may not be handed down to its only consumer.
 *
 * Passing rows to the section that renders them is the intended flow, and so
 * is handing a mutation's pending flag to a `forms/` child, which may not
 * fetch. What this catches is a screen that subscribes to a query so exactly
 * one sibling below it can render the result: every settle of that query then
 * re-renders the rest of the page. Two siblings genuinely sharing one result
 * pass.
 */
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

// One component per file, in an app. Biome's `noNestedComponentDefinitions`
// only sees a component declared inside another; two declared side by side
// pass it, and the second one is always the one nobody finds. The pattern is a
// tripwire on the usual top-level shapes, not a parser. The kit is exempt: a
// primitives file there exports a family meant to be read together
// (`AuthLink`, `AuthBackLink`, …).
const TOP_LEVEL_COMPONENT =
  /^(?:export\s+)?(?:default\s+)?(?:function\s+([A-Z]\w*)|const\s+([A-Z]\w*)\s*(?::[^=]+)?=\s*(?:\([^)]*\)\s*(?::[^=]*)?=>|\w+\s*=>|(?:memo|forwardRef)\())/gm;
for (const { app } of APPS) {
  const src = join(root, app, 'src');
  if (!existsSync(src)) continue;
  for (const file of walk(src)) {
    if (!file.endsWith('.tsx') || /\.(spec|test)\.tsx$/.test(file) || file.includes('/__tests__/'))
      continue;
    const names = [...readFileSync(file, 'utf8').matchAll(TOP_LEVEL_COMPONENT)].map(
      (match) => match[1] ?? match[2],
    );
    if (names.length > 1) {
      fail(
        `${relative(root, file)}: ${names.length} components (${names.join(', ')}) — one component per file; give each its own file in the kind it belongs to`,
      );
    }
  }
}

// The page frame is the shell's. A route declares its measure (`pane` in the
// kit's `shell/lib/pane.ts`) and the shell paints the ground and draws the
// frame (the scroll, the measure, the gutter) once. Two shapes put a frame
// back in a screen, and each is how pages drifted onto two greys at five
// widths: painting the ground or wrapping itself in `EditorPage`, and
// rebuilding the frame by hand, an element that scrolls around a centred
// `max-w-*` column. `public` is exempt: its pages render outside any shell,
// so they own their ground. Classes are read from each element's
// `className`, every string in it (a `cn(...)` included), with comments
// stripped first; a tripwire, not a parser.
const GROUND = /\bbg-(?:canvas|background)\b|<EditorPage(?:Body)?\b/;
const SCROLLS = /\boverflow-(?:y-)?auto\b/;
const GROUND_OWNERS = ['public'];
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** Every string literal in a tag's `className` value, as one class list. */
function classesOf(tag) {
  const at = tag.search(/\bclassName\s*=/);
  if (at === -1) return '';
  let i = tag.indexOf('=', at) + 1;
  while (/\s/.test(tag[i])) i += 1;
  let value;
  if (tag[i] === '"' || tag[i] === "'") value = tag.slice(i, tag.indexOf(tag[i], i + 1) + 1);
  else {
    let depth = 0;
    let j = i;
    for (; j < tag.length; j += 1) {
      if (tag[j] === '{') depth += 1;
      else if (tag[j] === '}' && --depth === 0) break;
    }
    value = tag.slice(i, j + 1);
  }
  return [...value.matchAll(/(["'`])((?:(?!\1).)*)\1/g)].map((m) => m[2]).join(' ');
}

const centred = (classes) => /\bmx?-auto\b/.test(classes) && /\bmax-w-/.test(classes);

/** The text inside the element whose opening tag ends at `from`, up to its closing tag. */
function childrenOf(source, name, from) {
  const tags = new RegExp(`<(/?)${name.replace('.', '\\.')}\\b`, 'g');
  tags.lastIndex = from;
  let depth = 1;
  let match = tags.exec(source);
  while (match !== null) {
    if (match[1]) {
      if (--depth === 0) return source.slice(from, match.index);
    } else if (
      !openingTag(source, match.index + match[0].length)
        .trimEnd()
        .endsWith('/')
    ) {
      depth += 1;
    }
    match = tags.exec(source);
  }
  return source.slice(from);
}

/** An element that scrolls with a centred `max-w-*` column inside it, if the file has one. */
function rebuiltFrame(source) {
  for (const open of source.matchAll(/<([A-Za-z][\w.]*)\b/g)) {
    const tag = openingTag(source, open.index + open[0].length);
    if (!SCROLLS.test(classesOf(tag)) || tag.trimEnd().endsWith('/')) continue;
    const inside = childrenOf(source, open[1], open.index + open[0].length + tag.length + 1);
    for (const child of inside.matchAll(/<([A-Za-z][\w.]*)\b/g)) {
      if (centred(classesOf(openingTag(inside, child.index + child[0].length)))) return true;
    }
  }
  return false;
}

for (const { app, features } of APPS) {
  const src = join(root, app, 'src');
  if (!existsSync(src)) continue;
  const owners = GROUND_OWNERS.map((name) => `${join(root, app, features, name)}/`);
  for (const file of walk(src)) {
    if (!file.endsWith('.tsx') || /\.(spec|test)\.tsx$/.test(file) || file.includes('/__tests__/'))
      continue;
    if (owners.some((owner) => file.startsWith(owner))) continue;
    const source = code(readFileSync(file, 'utf8'));
    const ground = source.match(GROUND);
    if (ground) {
      fail(
        `${relative(root, file)}: \`${ground[0]}\` — the console's ground and page frame are the shell's. Declare the page's measure as the route's \`staticData.pane\` and render only the content. See .agents/rules/frontend-architecture.md`,
      );
    }
    if (rebuiltFrame(source)) {
      fail(
        `${relative(root, file)}: an element that scrolls around a centred \`max-w-*\` column is the page frame rebuilt. Declare the measure as the route's \`staticData.pane\` and render only the content. See .agents/rules/frontend-architecture.md`,
      );
    }
  }
}

// Every query a frontend package's React layer declares shares entities across
// refetches (why: `packages/frontend/core/src/react/query.ts`). The core's
// `useQuery` and `useQueries` apply it, so the fence is on the import.
const QUERY_HOOK_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'@tanstack\/react-query'/g;
const FENCED_HOOKS = ['useQuery', 'useQueries', 'useSuspenseQuery', 'useSuspenseQueries'];
for (const pkg of readdirSync(join(root, 'packages/frontend'))) {
  const dir = join(root, 'packages/frontend', pkg, 'src/react');
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    // `query.ts` is the wrapper itself.
    if (!/\.tsx?$/.test(name) || /\.(spec|test)\.tsx?$/.test(name) || name === 'query.ts') continue;
    const source = readFileSync(join(dir, name), 'utf8');
    for (const match of source.matchAll(QUERY_HOOK_IMPORT)) {
      const names = match[1].split(',').map((part) => part.trim().replace(/^type\s+/, ''));
      for (const hook of FENCED_HOOKS.filter((fenced) => names.includes(fenced))) {
        fail(
          `packages/frontend/${pkg}/src/react/${name}: imports ${hook} from @tanstack/react-query — use the one from @oppenheimer/frontend-core/react, which shares entities across refetches`,
        );
      }
    }
  }
}

// How the console polls is one policy, `LIVE_POLL` in the product package's
// `live-poll.ts`, the only file that names TanStack's polling options. A
// `refetchInterval` anywhere else is a second policy nobody finds.
const sources = (dir) =>
  [...walk(dir)].filter(
    (file) =>
      /\.tsx?$/.test(file) && !/\.(spec|test)\.tsx?$/.test(file) && !file.includes('/__tests__/'),
  );
const polling = [
  ...APPS.flatMap(({ app }) =>
    existsSync(join(root, app, 'src')) ? sources(join(root, app, 'src')) : [],
  ),
  ...readdirSync(join(root, 'packages/frontend')).flatMap((pkg) => {
    const dir = join(root, 'packages/frontend', pkg, 'src/react');
    return existsSync(dir) ? sources(dir).filter((file) => !file.endsWith('/live-poll.ts')) : [];
  }),
];
for (const file of polling) {
  if (/\brefetchInterval\b/.test(readFileSync(file, 'utf8'))) {
    fail(
      `${relative(root, file)}: sets refetchInterval — polling is LIVE_POLL's (packages/frontend/consumer/src/react/live-poll.ts): a package hook spreads pollWhile(), and an app asks the package for the hook that polls`,
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
