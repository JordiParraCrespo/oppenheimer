#!/usr/bin/env node
/**
 * Scaffold a feature in a frontend app: the kind directories, a screen, the
 * section it composes, and a note at the top of each kind saying what goes
 * there and what it may import. The `/scaffold-feature` skill runs this; the
 * layout it produces is what `pnpm check:structure` and each app's `pnpm arch`
 * enforce.
 *
 * The screen and the section are two files rather than one on purpose. Given a
 * lone screen to fill, the next hand reaches for the query there and threads the
 * result down — which is how a page ends up re-rendering a form because a table
 * refetched. Starting with the query already one level down makes the shape the
 * checks want the shape that is already there.
 *
 *   node scripts/scaffold-feature.mjs --app web --module api-tokens [--screen api-tokens]
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, all) => (arg.startsWith('--') ? [arg.slice(2), all[i + 1]] : []))
    .filter((pair) => pair.length),
);
const APPS = {
  // oppenheimer:begin web
  web: {
    dir: 'apps/web',
    features: 'src/features',
    product: 'consumer',
    allow: ['public'],
    platform: 'web',
  },
  // oppenheimer:end web
};
const app = APPS[args.app];
if (!app || !args.module) {
  console.error(
    'usage: node scripts/scaffold-feature.mjs --app <web> --module <name> [--screen <name>]',
  );
  process.exit(2);
}
// `fileURLToPath`, not `new URL(...).pathname`: a pathname is URL-encoded, so a
// checkout under a directory with a space in it resolves to `/Macintosh%20SSD/...`
// and every `readdirSync` below it fails — or, worse, still relativises, and the
// paths silently match nothing they are compared against.
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const modulesOf = (pkg) => {
  const dir = join(root, 'packages/frontend', pkg, 'src/modules');
  // `core` is the kernel's own wiring (errors, storage), not something a feature renders.
  return existsSync(dir)
    ? readdirSync(dir).filter((n) => n !== 'core' && statSync(join(dir, n)).isDirectory())
    : [];
};
const allowed = [...modulesOf('core'), ...modulesOf(app.product), ...app.allow];
if (!allowed.includes(args.module)) {
  console.error(
    `"${args.module}" is not a module of @oppenheimer/frontend-core or @oppenheimer/frontend-${app.product}, nor on ${args.app}'s allowlist.\nA feature is named after the module whose entity it renders. Known: ${allowed.join(', ')}.\nIf the module does not exist yet, add it to the product package first (packages/frontend/${app.product}/src/modules/).`,
  );
  process.exit(1);
}

const KINDS = {
  screens:
    'What a route mounts: the page body. May call query hooks and the router. One screen per route.',
  sections:
    'A pane, a card group, a table — a fragment a screen or a cross-module route composes. May fetch.',
  dialogs: 'One dialog per file. Owns its mutation and renders the form beneath it. May fetch.',
  forms:
    'React Hook Form over a shared Zod schema. Props in (defaults, isPending, error), onSubmit out. Never imports the query port or the router.',
  components:
    'Entity UI: a row, a cell, a pill, a hero, a checklist. Props only. A subscription (useWatch, select) lives here, at the leaf that renders the value.',
  hooks:
    'use-*.ts combining queries and UI state. The only place an effect lives, with a comment naming the external system it synchronises.',
  lib: 'Types, mappers, config, constants. No JSX.',
  __tests__: 'Specs for the feature. Vitest, jsdom, Testing Library.',
};
const featureDir = join(root, app.dir, app.features, args.module);
if (existsSync(featureDir)) {
  console.error(
    `${app.dir}/${app.features}/${args.module} already exists; add files to its kind directories instead.`,
  );
  process.exit(1);
}
for (const [kind, note] of Object.entries(KINDS)) {
  const dir = join(featureDir, kind);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, '.gitkeep'),
    `${note}\nSee .agents/rules/frontend-architecture.md — kept until the first file lands, then delete me.\n`,
  );
}
const screen = args.screen ?? args.module;
const component = screen.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
// oppenheimer:begin web
const WEB_SCREEN = `import { PageHead } from '@oppenheimer/frontend-web';\nimport { useTranslation } from 'react-i18next';\nimport { ${component}Panel } from '@/features/${args.module}/sections/${screen}-panel';\n\n/** The ${screen} screen. Mount it from a route: \`component: () => <${component}Screen />\`. It composes; the section below fetches. */\nexport function ${component}Screen() {\n  const { t } = useTranslation();\n\n  return (\n    <>\n      <PageHead title={t('common.appName')} />\n      <${component}Panel />\n    </>\n  );\n}\n`;
const WEB_SECTION = `import { useTranslation } from 'react-i18next';\n\n/**\n * The ${screen} pane.\n *\n * A query belongs to whatever draws its result, and that is not automatically\n * this file. Call it here when this pane renders the result; when one child\n * does — a cell waiting on its own row, a dialog that needs a list only while\n * it is open — the query goes in that child, not here with the value threaded\n * down. \`pnpm check:structure\` catches the single-consumer case; the rest is\n * judgement. See .agents/rules/frontend-architecture.md.\n */\nexport function ${component}Panel() {\n  const { t } = useTranslation();\n\n  return <p>{t('common.appName')}</p>;\n}\n`;
// oppenheimer:end web
writeFileSync(join(featureDir, 'screens', `${screen}.tsx`), WEB_SCREEN);
writeFileSync(join(featureDir, 'sections', `${screen}-panel.tsx`), WEB_SECTION);
console.log(
  `Scaffolded ${app.dir}/${app.features}/${args.module}/ with a ${screen} screen and the section it composes.\n\nNext:\n  1. Mount the screen from a route (${app.dir}/src/routes/…). A route file composes; it stays under 120 lines.\n  2. Put each query in whatever draws its result — the section, or the cell or dialog inside it. Never on the screen above.\n  3. Put each piece in its kind: form → forms/, dialog → dialogs/, row → components/, effect → hooks/.\n  4. pnpm --filter @oppenheimer/${args.app} arch && pnpm check:structure\n`,
);
