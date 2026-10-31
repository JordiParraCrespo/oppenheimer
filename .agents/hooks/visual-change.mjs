// What counts as a change to what the console shows, and a fingerprint of
// that change. The one definition: the screenshot guard
// (`screenshot-guard.mjs`), the camera (`scripts/stack/screens.mjs`) and the
// pr-screenshots eval all import it, and the prose in AGENTS.md, the
// `local-stack` and `steward` skills and `.agents/rules/frontend-ui.md`
// points here rather than restating the list.
//
// The fingerprint is a hash of each visual file the branch changes, by what
// it says: a script with its comments taken out and its layout reprinted, a
// stylesheet without comments or runs of whitespace, JSON parsed. Screenshots
// record it when they are taken; they are of this code while it still
// matches. Committing, a checkout, `touch`, a comment edited or most of a
// reformat leave it alone; an edit to the code or the copy, or a merge that
// brings one, does not. A file that does not parse is hashed as it is.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** Paths whose change shows on screen: the console, the platform kit, the design system, the copy. */
export const VISUAL = [
  // oppenheimer:begin web
  /^apps\/web\/src\//,
  /^apps\/web\/public\//,
  /^apps\/web\/index\.html$/,
  /^packages\/frontend\/web\/src\//,
  /^packages\/frontend\/design-system\/web\/src\//,
  /^packages\/translations\/(?!scripts\/)/,
  // oppenheimer:end web
];
/** Beside them, but never on screen: tests, stories, docs. */
export const NOT_VISUAL = [/\/__tests__\//, /\.(spec|test|stories)\.[cm]?[jt]sx?$/, /\.md$/];

/** Whether a repo-relative path is one whose change shows on screen. */
export function isVisual(path) {
  return VISUAL.some((re) => re.test(path)) && !NOT_VISUAL.some((re) => re.test(path));
}

function git(root, ...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/**
 * A checkout's `origin/main` can be older than the `main` the branch was cut
 * from, and diffing against it counts main's own commits as the branch's. So
 * it is fetched first, briefly, at most every ten minutes; offline, the refs
 * already here are used.
 */
export function refreshMain(root) {
  const stamp = join(git(root, 'rev-parse', '--absolute-git-dir').trim(), 'visual-change-fetch');
  if (existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < 600_000) return;
  try {
    execFileSync('git', ['fetch', '--quiet', '--no-tags', 'origin', 'main'], {
      cwd: root,
      stdio: 'ignore',
      timeout: 8_000,
    });
  } catch {}
  try {
    writeFileSync(stamp, '');
  } catch {}
}

/** Where the branch left main: the nearer merge-base of `origin/main` and `main`. */
export function branchBase(root) {
  const bases = [];
  for (const ref of ['origin/main', 'main']) {
    try {
      const base = git(root, 'merge-base', ref, 'HEAD').trim();
      bases.push({ base, ahead: Number(git(root, 'rev-list', '--count', `${base}..HEAD`)) });
    } catch {}
  }
  if (bases.length === 0) throw new Error('no main to compare against');
  return bases.sort((a, b) => a.ahead - b.ahead)[0].base;
}

/**
 * The visual files the branch changes, committed or not, and their
 * fingerprint; null when there are none. Throws when there is no main.
 */
export function visualChange(root, { fetch = true } = {}) {
  if (fetch) refreshMain(root);
  const base = branchBase(root);
  const committed = git(root, 'diff', '--name-only', `${base}..HEAD`).split('\n');
  const pending = git(root, 'status', '--porcelain', '--untracked-files=all')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').at(-1));
  const files = [...new Set([...committed, ...pending])].filter(isVisual).sort();
  if (files.length === 0) return null;
  const hash = createHash('sha256');
  for (const file of files) {
    const path = join(root, file);
    const said = existsSync(path) ? substance(file, readFileSync(path, 'utf8')) : null;
    const digest = said === null ? 'deleted' : createHash('sha256').update(said).digest('hex');
    hash.update(`${file}\0${digest}\n`);
  }
  return { base, files, fingerprint: hash.digest('hex').slice(0, 16) };
}

let typescript;
/** The TypeScript compiler, from the checkout; null before `pnpm install`. */
function compiler() {
  if (typescript === undefined) {
    try {
      typescript = createRequire(import.meta.url)('typescript');
    } catch {
      typescript = null;
    }
  }
  return typescript;
}

/** A stylesheet without its comments, its whitespace runs one space; strings kept whole. */
function cssSubstance(text) {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'") {
      const end = text.indexOf(c, i + 1);
      const stop = end === -1 ? text.length : end + 1;
      out += text.slice(i, stop);
      i = stop - 1;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
      out += ' ';
    } else out += c;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * JSX text as React renders it: each line trimmed where it meets a line
 * break, blank lines dropped, the rest joined by one space.
 */
function jsxText(raw) {
  const lines = raw.split(/\r?\n/);
  return lines
    .map((line, i) => {
      let out = line;
      if (i > 0) out = out.replace(/^\s+/, '');
      if (i < lines.length - 1) out = out.replace(/\s+$/, '');
      return out;
    })
    .filter((line, i) => line !== '' || lines.length === 1 || i === 0)
    .filter(Boolean)
    .join(' ');
}

/**
 * A script's tokens, without what a comment or a reformat changes: comments
 * and whitespace (never tokens), the quotes around a string, semicolons, a
 * trailing comma, the parentheses a formatter wraps around JSX. JSX text is
 * kept as React renders it, so copy still counts.
 */
function scriptTokens(ts, source) {
  const K = ts.SyntaxKind;
  const out = [];
  const isJsx = (node) =>
    node.kind === K.JsxElement || node.kind === K.JsxSelfClosingElement || node.kind === K.JsxFragment;
  const visit = (node) => {
    // A doc comment is parsed into nodes of its own; it is still a comment.
    if (node.kind >= K.FirstJSDocNode && node.kind <= K.LastJSDocNode) return;
    if (node.kind === K.ParenthesizedExpression && isJsx(node.expression)) return visit(node.expression);
    if (node.kind === K.JsxText) {
      const text = jsxText(node.text);
      if (text) out.push(`jsx:${text}`);
      return;
    }
    if (node.kind === K.StringLiteral || node.kind === K.NoSubstitutionTemplateLiteral) {
      out.push(`str:${node.text}`);
      return;
    }
    const children = node.getChildren(source);
    if (children.length > 0) {
      for (const child of children) visit(child);
      return;
    }
    if (node.kind === K.SemicolonToken || node.kind === K.EndOfFileToken) return;
    const text = node.getText(source);
    if (text) out.push(text);
  };
  visit(source);
  const closers = new Set([')', ']', '}']);
  return out.filter((token, i) => !(token === ',' && closers.has(out[i + 1]))).map((t) => JSON.stringify(t)).join('\n');
}

/**
 * What a file says, for the fingerprint: the parts a comment or a reformat
 * cannot change. A script is its tokens (`scriptTokens`), a stylesheet is
 * read without comments, JSON is parsed. One that does not parse, and any
 * other kind of file, is taken as it is.
 */
export function substance(file, text) {
  const ts = /\.[cm]?[jt]sx?$/.test(file) ? compiler() : null;
  if (ts) {
    const kind = file.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : file.endsWith('.jsx')
        ? ts.ScriptKind.JSX
        : /\.[cm]?ts$/.test(file)
          ? ts.ScriptKind.TS
          : ts.ScriptKind.JS;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
    if (source.parseDiagnostics?.length) return text;
    return scriptTokens(ts, source);
  }
  if (file.endsWith('.css')) return cssSubstance(text);
  if (file.endsWith('.json')) {
    try {
      return JSON.stringify(JSON.parse(text));
    } catch {
      return text;
    }
  }
  return text;
}
