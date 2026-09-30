import type { IncomingHttpHeaders } from 'node:http';
import { AppError } from '@oppenheimer/backend-core';
import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { APIError } from 'better-auth/api';
import { fromNodeHeaders } from 'better-auth/node';

/**
 * Helpers for the delegating façade modules (organizations, invitations,
 * workspaces, admin) that expose Better Auth plugin operations as first-class
 * NestJS REST endpoints. The modules call `auth.api.*` server methods rather
 * than re-implementing writes to the Better-Auth-owned tables.
 */

export function betterAuthHeaders(headers: IncomingHttpHeaders): Headers {
  return fromNodeHeaders(headers);
}

/**
 * Low-level shaping helpers for the module mappers. Better Auth's `auth.api.*`
 * returns broad, strongly-typed objects; the mappers accept `unknown` and use
 * these to narrow once, so services never carry `as`-casts. Envelope helpers
 * unwrap Better Auth's `{ member }` / `{ members }` style responses.
 */
export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Unwrap a single-object envelope (e.g. `{ member: {...} }`); otherwise return the value itself. */
export function unwrap(value: unknown, key: string): unknown {
  const record = asRecord(value);
  return key in record ? record[key] : value;
}

/** Unwrap an array envelope (e.g. `{ members: [...] }`); otherwise coerce the value to an array. */
export function unwrapArray(value: unknown, key: string): unknown[] {
  const record = asRecord(value);
  return key in record ? asArray(record[key]) : asArray(value);
}

/** What a Better Auth `APIError` carries, once narrowed. */
export interface BetterAuthFailure {
  /** Better Auth's own `SCREAMING_SNAKE_CASE` code, when it set one. */
  upstreamCode?: string;
  /** Better Auth's English explanation, used as the problem `detail`. */
  message?: string;
  status: number;
}

/**
 * Folds a Better Auth failure onto an entry in the calling module's error
 * catalog — see `organizations/infrastructure/organization-error.util.ts`.
 */
export type BetterAuthErrorMapper = (failure: BetterAuthFailure) => ErrorDefinition;

/**
 * An `APIError` carries an HTTP `statusCode` and a `body` (`{ message, code }`),
 * neither of which its public type surfaces, so read them through `asRecord`.
 */
function readApiError(err: APIError): BetterAuthFailure {
  const e = asRecord(err);
  const body = asRecord(e.body);

  return {
    upstreamCode: typeof body.code === 'string' ? body.code : undefined,
    message:
      typeof body.message === 'string'
        ? body.message
        : typeof e.message === 'string'
          ? e.message
          : undefined,
    status: typeof e.statusCode === 'number' ? e.statusCode : 500,
  };
}

/**
 * Builds the `invoke` helper a façade module wraps every `auth.api.*` call in.
 *
 * The mapper folds Better Auth's `APIError` onto a catalog
 * {@link ErrorDefinition}, so the response is a problem document with a
 * documented `code`, like any `AppError`. A bare `HttpException` would not do:
 * `AllExceptionsFilter` reads no `code` off one, leaving a client nothing to
 * branch on. Better Auth's code becomes the `upstreamCode` extension member and
 * its message the problem `detail`.
 *
 * ```ts
 * const invokeOrganizationApi = betterAuthInvoker(mapOrganizationError);
 * const org = await invokeOrganizationApi(() => auth.api.createOrganization({ … }));
 * ```
 */
export function betterAuthInvoker(mapper: BetterAuthErrorMapper) {
  return async function invoke<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof APIError) {
        const failure = readApiError(err);
        throw new AppError(mapper(failure), {
          detail: failure.message,
          extensions: failure.upstreamCode ? { upstreamCode: failure.upstreamCode } : undefined,
          cause: err,
        });
      }

      // Not an `APIError` at all — a transport failure, or a bug in the plugin.
      // The module's own upstream-failure entry keeps it inside the catalog;
      // the filter blanks the detail of a 5xx, so the cause only reaches the log.
      throw new AppError(mapper({ status: 500 }), { cause: err });
    }
  };
}
