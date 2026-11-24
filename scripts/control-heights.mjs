#!/usr/bin/env node
/**
 * Every interactive control in the console stands on one height ramp, 28 / 34
 * / 42px (`--control-h-sm|md|lg`, the design system's `globals.css`), so a
 * row of a button, a field, a select and a tab reads as one height. This
 * finds a control whose height is written by hand instead: a class list that
 * belongs to a control and sets `h-*`, `size-*` or `min-h-*` to anything but
 * a `--control-h-*` token.
 *
 * A class list belongs to a control when it styles focus, an open popup or a
 * pressed state (`focus-visible:`, `data-popup-open:`, `data-pressed:`,
 * `aria-expanded:`), or when it is the `className` of a `<button>`,
 * `<input>`, `<Button>`, `<IconButton>`, `<Input>` or a `…Trigger`.
 *
 * `CONTROL_HEIGHT_DEBT` (`control-height-debt.mjs`) holds each file that had
 * some when the campaign started to its count: one more fails, and one fewer
 * fails until the count there comes down, so the list only shrinks. The
 * campaign's ledger is `.agents/skills/control-height-campaign/ledger.md`.
 *
 *   node scripts/control-heights.mjs           check against the debt
 *   node scripts/control-heights.mjs --list    print every finding
 *   node scripts/control-heights.mjs --debt    print the counts as a debt map
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { CONTROL_HEIGHT_DEBT } from './control-height-debt.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const ROOTS = [
  'packages/frontend/design-system/web/src',
  'packages/frontend/web/src',
  // oppenheimer:begin web
  'apps/web/src',
  // oppenheimer:end web
];

const SKIP = /\.(test|spec|stories)\.tsx$|\.gen\.ts$/;

const CONTROL_STATE =
  /(?:^|\s)(?:[\w-]+(?:\[[^\]]*\])?(?:\/[\w-]+)?:)*(?:focus-visible|data-popup-open|data-pressed|aria-expanded):/;

const CONTROL_TAG =
  /<(?:button|input|select|(?:[A-Z]\w*)?(?:Button|Trigger|Input|Toggle|Tab|Select))\b[^<>]*$/;

/** A height or a square size, on any variant chain (`group-data-[size=md]/tabs:h-8`). */
const HEIGHT =
  /(?:^|[\s"'`])((?:[\w-]+(?:\[[^\]]*\])?(?:\/[\w-]+)?:)*!?(?:min-h|h|size)-(?:[\d.]+|\[[^\]]+\]|\([^)]*\))!?)(?=[\s"'`]|$)/g;

const ALLOWED = /-\(--control-h-(?:sm|md|lg)\)$/;

/**
 * The band a row's control stands in: 20 to 48px. Below it is a dot, a glyph
 * or a rule inside the control; above it a text area or a panel; neither sits
 * on the ramp.
 */
const BAND = { min: 20, max: 48 };

/** The pixels a height utility sets, or null when it is not a fixed length. */
export function pixels(token) {
  const value = token.replace(/^.*?(?:min-h|h|size)-/, '');
  if (/^[\d.]+$/.test(value)) return Number(value) * 4;
  const px = value.match(/^\[([\d.]+)px\]$/);
  return px ? Number(px[1]) : null;
}

/** `size-*` and `h-*` that only shape a glyph inside the control: `[&_svg]:size-4`. */
const ON_A_CHILD = /^\[&[^\]]*\]:|^\*:|^has-|^group-has-/;

function classStrings(source) {
  const strings = [];
  const file = ts.createSourceFile(
    'x.tsx',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      strings.push({ text: node.text, index: node.getStart(file) });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return strings;
}

/**
 * A variant map or a `cn()` list splits one control's classes over several
 * strings (`group-data-[size=md]/tabs:h-8` beside the base list that has the
 * focus ring): a string within 600 characters of one that styles a control
 * state counts as that control's.
 */
function nearControlState(strings, text, index) {
  return strings.some(
    (other) =>
      other.text !== text && Math.abs(other.index - index) < 600 && CONTROL_STATE.test(other.text),
  );
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

export function findings(source) {
  const out = [];
  const strings = classStrings(source);
  for (const { text, index } of strings) {
    if (!/(?:^|[\s:!])(?:min-h|h|size)-/.test(text)) continue;
    const before = source.slice(Math.max(0, index - 400), index).replaceAll('=>', '');
    const isControl =
      CONTROL_STATE.test(text) ||
      CONTROL_TAG.test(before) ||
      nearControlState(strings, text, index);
    if (!isControl) continue;
    for (const match of text.matchAll(HEIGHT)) {
      const token = match[1];
      const bare = token.replace(/^!|!$/g, '').replace(/:!/, ':');
      if (ON_A_CHILD.test(bare)) continue;
      if (ALLOWED.test(bare)) continue;
      const px = pixels(bare);
      if (px === null || px < BAND.min || px > BAND.max) continue;
      out.push({ line: lineOf(source, index), token, px });
    }
  }
  return out;
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      yield* files(path);
    } else if (name.endsWith('.tsx') && !SKIP.test(name)) {
      yield path;
    }
  }
}

export function scan(root = ROOT) {
  const byFile = new Map();
  for (const base of ROOTS) {
    for (const path of files(join(root, base))) {
      const found = findings(readFileSync(path, 'utf8'));
      if (found.length) byFile.set(relative(root, path), found);
    }
  }
  return byFile;
}

export function check(byFile, debt = CONTROL_HEIGHT_DEBT) {
  const errors = [];
  for (const [file, found] of byFile) {
    const allowed = debt.get(file) ?? 0;
    if (found.length > allowed) {
      errors.push(
        `${file}: ${found.length} hand-written control heights, ${allowed} allowed\n${found
          .map(({ line, token }) => `    ${file}:${line}  ${token}`)
          .join('\n')}`,
      );
    }
  }
  for (const [file, allowed] of debt) {
    const count = byFile.get(file)?.length ?? 0;
    if (count < allowed) {
      errors.push(
        `${file}: ${count} hand-written control heights, down from ${allowed}: lower its count in scripts/control-height-debt.mjs`,
      );
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const byFile = scan();
  const arg = process.argv[2];
  if (arg === '--list') {
    for (const [file, found] of byFile)
      for (const { line, token } of found) console.log(`${file}:${line}  ${token}`);
  } else if (arg === '--debt') {
    // The console's own files (the last root) sit in the starter's `web` block, as in the map.
    for (const [file, found] of [...byFile].sort()) {
      const line = `  ['${file}', ${found.length}],`;
      console.log(
        file.startsWith(ROOTS.at(-1))
          ? `  // oppenheimer:begin web\n${line}\n  // oppenheimer:end web`
          : line,
      );
    }
  } else {
    const errors = check(byFile);
    if (errors.length) {
      console.error(
        `A control's height comes from the ramp: h-(--control-h-sm|md|lg) or size-(--control-h-…), or a component's \`size\`.\n\n${errors.join('\n\n')}`,
      );
      process.exit(1);
    }
    const total = [...byFile.values()].reduce((sum, found) => sum + found.length, 0);
    console.log(`control heights: ${total} left in the debt, none new`);
  }
}
