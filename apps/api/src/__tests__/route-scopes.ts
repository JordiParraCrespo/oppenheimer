import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Reads every HTTP route's scope declaration from the controllers' source,
 * for `route-scope-coverage.spec.ts`. Textual, like
 * `route-policy-coverage.spec.ts`, because booting the app needs a database.
 */

const SRC = resolve(__dirname, '..');
const HTTP_METHOD = /^\s*@(Get|Post|Patch|Put|Delete|Head|Options|All|Sse)\(\s*(?:'([^']*)')?/;
const METHOD_SIGNATURE =
  /^\s{2}(?:public\s+|private\s+|protected\s+)?(?:async\s+)?[A-Za-z_]\w*\s*\(/;
const CLASS_DECLARATION = /^export class /;

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

function scopesIn(block: string): string[] | undefined {
  const match = /@RequireScopes\(([^)]*)\)/.exec(block);
  if (!match) return undefined;
  return [...match[1].matchAll(/'([^']+)'/g)].map((scope) => scope[1]);
}

function joinPath(...parts: string[]): string {
  return `/${parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/')}`;
}

function routesIn(file: string): DeclaredRoute[] {
  const lines = readFileSync(file, 'utf8').split('\n');
  const classAt = lines.findIndex((line) => CLASS_DECLARATION.test(line));
  if (classAt === -1) return [];
  const prelude = lines.slice(0, classAt).join('\n');
  const base = /@Controller\(\s*'([^']*)'/.exec(prelude)?.[1] ?? '';
  const classScopes = scopesIn(prelude);
  const classAny = prelude.includes('@AllowAnyScope(');

  const routes: DeclaredRoute[] = [];
  let block: string[] = [];
  for (const line of lines.slice(classAt + 1)) {
    if (!METHOD_SIGNATURE.test(line)) {
      block.push(line);
      continue;
    }
    const text = block.join('\n');
    block = [];
    const http = text
      .split('\n')
      .map((candidate) => HTTP_METHOD.exec(candidate))
      .find(Boolean);
    if (!http) continue;
    const verb = http[1] === 'Sse' ? 'GET' : http[1].toUpperCase();
    const own = scopesIn(text) ?? classScopes;
    const any = classAny || text.includes('@AllowAnyScope(');
    routes.push({
      route: `${verb} ${joinPath('v1', base, http[2] ?? '')}`,
      file: relative(SRC, file),
      scopes: own ?? (any ? 'any' : 'session-only'),
      contradictory: own !== undefined && any,
    });
  }
  return routes;
}

function controllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : controllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

export function declaredRoutes(): DeclaredRoute[] {
  return controllerFiles(SRC).flatMap(routesIn);
}
