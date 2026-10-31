/**
 * The component catalog cannot drift from the design system.
 *
 * "Reach for the design system before writing markup" is a table: the table
 * in `.agents/rules/frontend-ui.md` and the rest of it in
 * `.agents/reference/frontend-ui-catalog.md`. Its "Use" and "Not" columns are
 * judgement, which no export carries, so the table is written by hand. What a
 * script can hold is the link between the two:
 *
 * - every component a row's "Use" column names is exported, from the design
 *   system's `src/index.ts` or, for "the kit's X", from the platform kit
 *   (`QueryState.Pending` and the other compound parts count as their root's);
 * - every module the design system's index exports components from is named
 *   in the table, or sits in `UNCATALOGUED` with the reason it has no row.
 *
 * A renamed or deleted component fails the first; a new one with no row fails
 * the second. Run by `pnpm check:structure`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Design-system modules with no catalog row, and why. Keep it short: a row is the better answer. */
export const UNCATALOGUED = new Map([
  ['./components/brand-glyph', "brand art (providers' logos); nothing hand-built competes with it"],
  [
    './components/brand-mark',
    "brand art (the product's mark); nothing hand-built competes with it",
  ],
  ['./components/wordmark', "brand art (the product's name); nothing hand-built competes with it"],
  ['./components/sonner', '`Toaster` is mounted once, at the root of the console app'],
  ['./components/kbd', 'a plain primitive with no hand-built rival to warn against'],
  ['./components/link', 'a plain primitive with no hand-built rival to warn against'],
  ['./components/tooltip', 'a plain primitive with no hand-built rival to warn against'],
  ['./components/password-input', 'a plain primitive with no hand-built rival to warn against'],
  ['./components/diff-stat', 'a +/- count; nothing hand-built competes with it'],
  ['./components/inbox', "the Inbox screen's own parts; no other screen draws them"],
  ['./components/success-mark', "the onboarding Ready step's mark; no other screen draws it"],
  ['./components/image-carousel', "the sign-in page's art panel; no other screen draws it"],
  ['./components/settings-nav', "Settings' navigation, drawn by the kit's settings sidebar"],
  ['./components/chat-image', 'attachment parts ChatComposer, ChatTranscript and the kit draw'],
  [
    './components/search-list',
    "a menu submenu's search-and-list body; the filter-menu row covers the choice",
  ],
]);

const PASCAL = /^[A-Z][A-Za-z0-9]*$/;

function splitNames(list) {
  return list
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith('type '))
    .map((part) => part.split(/\s+as\s+/).pop());
}

/** Value exports of the design system's index, by the module they come from. */
export function indexExports(source) {
  const modules = new Map();
  for (const match of source.matchAll(/export\s+(type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    if (match[1]) continue;
    modules.set(match[3], [...(modules.get(match[3]) ?? []), ...splitNames(match[2])]);
  }
  return modules;
}

/** Names a source file exports, plus the parts of an `Object.assign(Root, { Part })` compound. */
export function sourceExports(source) {
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:function|const|class)\s+([A-Za-z0-9_]+)/g))
    names.add(match[1]);
  for (const match of source.matchAll(/export\s+\{([^}]*)\}/g))
    for (const name of splitNames(match[1])) names.add(name);
  for (const match of source.matchAll(/Object\.assign\(\s*\w+\s*,\s*\{([^}]*)\}/g))
    for (const key of match[1].matchAll(/(\w+)\s*(?=[:,]|\s*$)/g)) names.add(key[1]);
  return names;
}

/** Every backticked PascalCase name in the text. */
export function mentionedNames(text) {
  const names = new Set();
  for (const code of text.matchAll(/`([^`]+)`/g))
    for (const word of code[1].matchAll(/\b[A-Z][A-Za-z0-9]*\b/g)) names.add(word[0]);
  return names;
}

/** The leading PascalCase name of each backticked span in a catalog row's "Use" cell. */
export function useColumnNames(text) {
  const rows = [];
  text.split('\n').forEach((line, index) => {
    if (!line.startsWith('| ') || /^\|\s*-/.test(line) || /^\|\s*Need\s*\|/.test(line)) return;
    const use = line.split(' | ')[1];
    if (!use) return;
    for (const code of use.matchAll(/`([^`]+)`/g)) {
      const name = code[1].match(/^([A-Z][A-Za-z0-9]*)/)?.[1];
      if (name) rows.push({ line: index + 1, name });
    }
  });
  return rows;
}

/**
 * The drift between the catalog and what is exported.
 * `docs` is `[{ file, text }]`; `designSystem` the index source; `kit` the set of names the kit exports.
 */
export function catalogProblems({ docs, designSystem, kit, uncatalogued = UNCATALOGUED }) {
  const modules = indexExports(designSystem);
  const exported = new Set([...modules.values()].flat());
  const problems = [];

  for (const { file, text } of docs) {
    for (const { line, name } of useColumnNames(text)) {
      if (exported.has(name) || kit.has(name)) continue;
      problems.push(
        `${file}:${line}: \`${name}\` is not exported by @oppenheimer/design-system-web or @oppenheimer/frontend-web — rename the row or drop it with the component`,
      );
    }
  }

  const mentioned = new Set(docs.flatMap(({ text }) => [...mentionedNames(text)]));
  for (const [module, names] of modules) {
    const components = names.filter((name) => PASCAL.test(name) && /[a-z]/.test(name));
    if (components.length === 0) continue;
    const named = components.some((name) => mentioned.has(name));
    if (named && uncatalogued.has(module)) {
      problems.push(
        `scripts/ui-catalog.mjs: ${module} has a catalog row now — take it off UNCATALOGUED`,
      );
    }
    if (named || uncatalogued.has(module)) continue;
    problems.push(
      `${module} (${components.join(', ')}): exported by the design system but in no catalog row — add one to .agents/reference/frontend-ui-catalog.md, or a reason to UNCATALOGUED in scripts/ui-catalog.mjs`,
    );
  }
  for (const module of uncatalogued.keys()) {
    if (!modules.has(module))
      problems.push(
        `scripts/ui-catalog.mjs: UNCATALOGUED lists ${module}, which the index no longer exports — remove it`,
      );
  }
  return problems;
}

function kitNames(dir, names = new Set()) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__') kitNames(path, names);
    } else if (/\.tsx?$/.test(entry) && !/\.(spec|test)\.tsx?$/.test(entry)) {
      for (const name of sourceExports(readFileSync(path, 'utf8'))) names.add(name);
    }
  }
  return names;
}

/** The check against the repository; empty when the catalog or the design system is not there. */
export function repositoryCatalogProblems(root) {
  const files = ['.agents/rules/frontend-ui.md', '.agents/reference/frontend-ui-catalog.md'];
  const index = join(root, 'packages/frontend/design-system/web/src/index.ts');
  const kitDir = join(root, 'packages/frontend/web/src');
  if (!files.every((file) => existsSync(join(root, file))) || !existsSync(index)) return [];
  const docs = files.map((file) => ({ file, text: readFileSync(join(root, file), 'utf8') }));
  const kit = existsSync(kitDir) ? kitNames(kitDir) : new Set();
  return catalogProblems({ docs, designSystem: readFileSync(index, 'utf8'), kit });
}
