import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Reads every HTTP route's scope declaration from the controllers' source,
 * for `route-scope-coverage.spec.ts`. Textual, like
 * `route-policy-coverage.spec.ts`, because booting the app needs a database.
 *
 * It fails closed. A decorator is read with its arguments however many lines
 * they span, and an argument it cannot read for certain (a template literal,
 * a constant, a spread, a non-literal version), a file with a second class, a
 * route decorator outside a method it can see, or a `@Controller` outside a
 * `*.controller.ts` file is reported in `unreadable` rather than guessed at.
 * A guess would default to `session-only`, which is the one answer that
 * hides a route behind a missing scope.
 */

const SRC = resolve(__dirname, '..');
const HTTP_VERBS = ['Get', 'Post', 'Patch', 'Put', 'Delete', 'Head', 'Options', 'All', 'Sse'];
const METHOD_SIGNATURE =
  /^\s{2}(?:public\s+|private\s+|protected\s+)?(?:async\s+)?[A-Za-z_]\w*\s*\(/;
const CLASS_DECLARATION = /^(?:export\s+)?(?:abstract\s+)?class\s/;
/** Where versioning is switched on, and so where the default version lives. */
const BOOTSTRAP = 'main.ts';

/** What a route admits a scoped credential with. */
export type ScopeDeclaration = string[] | 'any' | 'session-only';

export interface DeclaredRoute {
  /** `GET /v1/hosts/:hostId`, the inventory's key. */
  route: string;
  file: string;
  scopes: ScopeDeclaration;
  /** Both `@RequireScopes` and `@AllowAnyScope` on one route. */
  contradictory: boolean;
}

export interface RouteScan {
  routes: DeclaredRoute[];
  /** `file: why`, for every declaration the scan could not read for certain. */
  unreadable: string[];
}

interface Decorator {
  name: string;
  /** The raw text between the parentheses. */
  args: string;
}

class Unreadable extends Error {}

/**
 * `text` with its comments blanked out (newlines kept), so a decorator quoted
 * in a doc comment is neither read nor counted. String literals are skipped
 * whole, so `'https://…'` is not a comment.
 */
function withoutComments(text: string): string {
  let out = '';
  let quote: string | undefined;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      out += char;
      if (char === '\\') out += text[++index] ?? '';
      else if (char === quote) quote = undefined;
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
      out += char;
    } else if (char === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
      out += '\n';
    } else if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(index, stop).replace(/[^\n]/g, ' ');
      index = stop - 1;
    } else out += char;
  }
  return out;
}

/**
 * Every `@Name(...)` in `text`, with its arguments matched by parenthesis
 * depth outside string literals, so an argument list may span lines.
 */
function decoratorsIn(text: string): Decorator[] {
  const found: Decorator[] = [];
  const start = /@([A-Za-z_]\w*)\(/g;
  for (let match = start.exec(text); match; match = start.exec(text)) {
    let depth = 1;
    let quote: string | undefined;
    let index = match.index + match[0].length;
    for (; index < text.length && depth > 0; index += 1) {
      const char = text[index];
      if (quote) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = undefined;
      } else if (char === "'" || char === '"' || char === '`') quote = char;
      else if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
    }
    if (depth > 0) throw new Unreadable(`@${match[1]}( is never closed`);
    found.push({ name: match[1], args: text.slice(match.index + match[0].length, index - 1) });
    start.lastIndex = index;
  }
  return found;
}

/** The arguments as plain string literals, or `Unreadable` for anything else. */
function stringLiterals(decorator: Decorator): string[] {
  const parts = decorator.args
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.map((part) => {
    const literal = /^(['"])([^'"\\`$]*)\1$/.exec(part);
    if (!literal)
      throw new Unreadable(`@${decorator.name}(${decorator.args.trim()}) is not literal`);
    return literal[2];
  });
}

/** The one literal argument of a decorator that takes at most one; `undefined` when empty. */
function optionalLiteral(decorator: Decorator): string | undefined {
  const values = stringLiterals(decorator);
  if (values.length > 1) throw new Unreadable(`@${decorator.name} has more than one argument`);
  return values[0];
}

function only(decorators: Decorator[], name: string): Decorator | undefined {
  const matching = decorators.filter((decorator) => decorator.name === name);
  if (matching.length > 1) throw new Unreadable(`@${name} appears twice on one declaration`);
  return matching[0];
}

function joinPath(...parts: string[]): string {
  return `/${parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/')}`;
}

/** `defaultVersion` from the bootstrap's `enableVersioning`, as the app itself reads it. */
function defaultVersion(): string {
  const source = readFileSync(join(SRC, BOOTSTRAP), 'utf8');
  const match = /enableVersioning\(\{[^}]*defaultVersion:\s*'([^']+)'/.exec(source);
  if (!match) throw new Error(`${BOOTSTRAP}: no literal defaultVersion in enableVersioning`);
  return match[1];
}

function routesIn(file: string, fallbackVersion: string): DeclaredRoute[] {
  const source = withoutComments(readFileSync(file, 'utf8'));
  const lines = source.split('\n');
  const classes = lines.filter((line) => CLASS_DECLARATION.test(line));
  const httpTotal = decoratorsIn(source).filter((d) => HTTP_VERBS.includes(d.name)).length;
  if (classes.length === 0) {
    if (httpTotal > 0) throw new Unreadable('route decorators outside any class');
    return [];
  }
  if (classes.length > 1) throw new Unreadable(`${classes.length} classes in one controller file`);
  const classAt = lines.findIndex((line) => CLASS_DECLARATION.test(line));

  const prelude = decoratorsIn(lines.slice(0, classAt).join('\n'));
  const controller = only(prelude, 'Controller');
  const base = controller ? (optionalLiteral(controller) ?? '') : '';
  const classScopes = only(prelude, 'RequireScopes');
  const classAny = only(prelude, 'AllowAnyScope') !== undefined;
  const classVersion = only(prelude, 'Version');
  const versionOf = (decorator: Decorator | undefined): string | undefined =>
    decorator && (optionalLiteral(decorator) ?? '');

  const routes: DeclaredRoute[] = [];
  let block: string[] = [];
  for (const line of lines.slice(classAt + 1)) {
    if (!METHOD_SIGNATURE.test(line)) {
      block.push(line);
      continue;
    }
    const decorators = decoratorsIn(block.join('\n'));
    block = [];
    const http = decorators.filter((decorator) => HTTP_VERBS.includes(decorator.name));
    if (http.length === 0) continue;
    if (http.length > 1) throw new Unreadable(`${line.trim()} has ${http.length} route decorators`);
    const verb = http[0].name === 'Sse' ? 'GET' : http[0].name.toUpperCase();
    const path = optionalLiteral(http[0]) ?? '';
    const ownScopes = only(decorators, 'RequireScopes');
    const own = ownScopes ?? classScopes;
    const scopes = own ? stringLiterals(own) : undefined;
    if (own && scopes?.length === 0) throw new Unreadable(`@RequireScopes() names no scope`);
    const any = classAny || only(decorators, 'AllowAnyScope') !== undefined;
    const version =
      versionOf(only(decorators, 'Version')) ?? versionOf(classVersion) ?? fallbackVersion;
    routes.push({
      route: `${verb} ${joinPath(version ? `v${version}` : '', base, path)}`,
      file: relative(SRC, file),
      scopes: scopes ?? (any ? 'any' : 'session-only'),
      contradictory: scopes !== undefined && any,
    });
  }
  // Every route decorator in the file must have been read on a method.
  if (routes.length !== httpTotal) {
    throw new Unreadable(`${httpTotal} route decorators, ${routes.length} read on a method`);
  }
  return routes;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Every route the controllers declare, and every declaration the scan refused to guess. */
export function scanRoutes(directory = SRC): RouteScan {
  const fallbackVersion = defaultVersion();
  const routes: DeclaredRoute[] = [];
  const unreadable: string[] = [];
  for (const file of sourceFiles(directory)) {
    const name = relative(SRC, file);
    if (!file.endsWith('.controller.ts')) {
      // A controller the scan would never open is a route it would never check.
      if (/@Controller\(/.test(withoutComments(readFileSync(file, 'utf8')))) {
        unreadable.push(`${name}: @Controller outside a *.controller.ts file`);
      }
      continue;
    }
    try {
      routes.push(...routesIn(file, fallbackVersion));
    } catch (error) {
      if (!(error instanceof Unreadable)) throw error;
      unreadable.push(`${name}: ${error.message}`);
    }
  }
  return { routes, unreadable };
}
