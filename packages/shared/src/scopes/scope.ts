import type { AppAbility } from '../permissions';
import {
  PERMISSION_GROUPS,
  SCOPE_ACCESS_LEVELS,
  SCOPES,
  type Scope,
  type ScopeAccessLevel,
  type ScopePolicy,
  type ScopeResource,
} from './catalog';

const SCOPE_SET = new Set<string>(SCOPES);

/** Type guard: is `value` a scope in the catalog? */
export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && SCOPE_SET.has(value);
}

/** Split a scope into its resource and access level. Throws if unknown. */
export function parseScope(scope: Scope): {
  resource: ScopeResource;
  access: ScopeAccessLevel;
} {
  const [resource, access] = scope.split(':') as [ScopeResource, ScopeAccessLevel];
  return { resource, access };
}

/**
 * Expand a granted set to everything it implies: `write` on a resource always
 * implies `read` on it, so a token granted `users:write` can list users
 * without the screen having to tick both boxes.
 */
export function expandScopes(scopes: Iterable<Scope>): Set<Scope> {
  const expanded = new Set<Scope>();
  for (const scope of scopes) {
    expanded.add(scope);
    const { resource, access } = parseScope(scope);
    if (access === 'write') expanded.add(`${resource}:read`);
  }
  return expanded;
}

/** Does the granted set satisfy `required` (honouring write ⇒ read)? */
export function hasScope(granted: Iterable<Scope>, required: Scope): boolean {
  return expandScopes(granted).has(required);
}

/** Does the granted set satisfy every one of `required`? */
export function hasAllScopes(granted: Iterable<Scope>, required: readonly Scope[]): boolean {
  if (required.length === 0) return true;
  const expanded = expandScopes(granted);
  return required.every((scope) => expanded.has(scope));
}

/** The subset of `required` that the granted set does *not* cover. */
export function missingScopes(
  granted: Iterable<Scope>,
  required: readonly Scope[],
): readonly Scope[] {
  const expanded = expandScopes(granted);
  return required.filter((scope) => !expanded.has(scope));
}

/**
 * Partition arbitrary input (CLI flags, OAuth `scope` parameters, stored JSON)
 * into recognised scopes and rejects. Callers decide whether an unknown scope
 * is an error or is dropped — nothing is silently coerced.
 */
export function normalizeScopes(input: readonly unknown[]): {
  scopes: Scope[];
  unknown: string[];
} {
  const scopes: Scope[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const value of input) {
    const candidate = typeof value === 'string' ? value.trim() : '';
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    if (isScope(candidate)) scopes.push(candidate);
    else unknown.push(candidate);
  }

  return { scopes: sortScopes(scopes), unknown };
}

/** Parse a space- or comma-separated scope string (OAuth style). */
export function parseScopeString(value: string | null | undefined): {
  scopes: Scope[];
  unknown: string[];
} {
  return normalizeScopes((value ?? '').split(/[\s,]+/));
}

/** Render scopes as the space-separated string OAuth uses. */
export function stringifyScopes(scopes: Iterable<Scope>): string {
  return sortScopes([...scopes]).join(' ');
}

/** Sort scopes into catalog order so stored and displayed lists are stable. */
export function sortScopes(scopes: readonly Scope[]): Scope[] {
  const order = new Map(SCOPES.map((scope, index) => [scope, index]));
  return [...scopes].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/**
 * Group scopes by resource, e.g. `{ users: ['read'], roles: ['read','write'] }`.
 * This is the storage shape for a token's permissions and what the permission
 * picker binds to.
 */
export function scopesToRecord(
  scopes: Iterable<Scope>,
): Partial<Record<ScopeResource, ScopeAccessLevel[]>> {
  const record: Partial<Record<ScopeResource, ScopeAccessLevel[]>> = {};
  for (const scope of sortScopes([...scopes])) {
    const { resource, access } = parseScope(scope);
    const levels = record[resource] ?? [];
    if (!levels.includes(access)) levels.push(access);
    record[resource] = levels;
  }
  return record;
}

/** Inverse of {@link scopesToRecord}; unknown entries are dropped. */
export function scopesFromRecord(
  record: Partial<Record<string, readonly string[]>> | null | undefined,
): Scope[] {
  const candidates: string[] = [];
  for (const [resource, levels] of Object.entries(record ?? {})) {
    for (const level of levels ?? []) candidates.push(`${resource}:${level}`);
  }
  return normalizeScopes(candidates).scopes;
}

/** Every scope whose level declares `policy` among its backing rules. */
export function scopesForPolicy(policy: ScopePolicy): Scope[] {
  const matches: Scope[] = [];
  for (const group of PERMISSION_GROUPS) {
    for (const level of SCOPE_ACCESS_LEVELS) {
      const definition = group.levels[level];
      const backs = definition.policies.some(
        (candidate) => candidate.action === policy.action && candidate.subject === policy.subject,
      );
      if (backs) matches.push(definition.scope);
    }
  }
  return matches;
}

/**
 * The scopes a principal is allowed to put on a credential they mint: a token
 * may never exceed its creator's own reach. A level is grantable when the
 * creator's ability satisfies at least one of its backing rules; per-request
 * checks then narrow the token further to whatever the owner can still do at
 * the time of the call.
 *
 * Levels with no backing rules (the caller's own profile) are always
 * grantable — every authenticated principal has access to their own account.
 */
export function grantableScopes(ability: AppAbility): Scope[] {
  const grantable: Scope[] = [];

  for (const group of PERMISSION_GROUPS) {
    for (const level of SCOPE_ACCESS_LEVELS) {
      const definition = group.levels[level];
      const allowed =
        definition.policies.length === 0 ||
        definition.policies.some((policy) => ability.can(policy.action, policy.subject));
      if (allowed) grantable.push(definition.scope);
    }
  }

  return grantable;
}

/** Scopes in `requested` that `ability` may not grant. */
export function ungrantableScopes(ability: AppAbility, requested: readonly Scope[]): Scope[] {
  const grantable = new Set(grantableScopes(ability));
  return requested.filter((scope) => !grantable.has(scope));
}
