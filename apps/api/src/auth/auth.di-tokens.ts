/**
 * `auth` is `@Global`, so what it binds here is the whole application's way of
 * asking these questions. Other modules inject the token and depend on the
 * port beside it — never on the adapter, which is where Better Auth lives.
 */

export const DELEGATED_SESSION = Symbol('DELEGATED_SESSION');

export const CREDENTIAL_SCOPE = Symbol('CREDENTIAL_SCOPE');

export const CREDENTIAL_VERIFIER = Symbol('CREDENTIAL_VERIFIER');

export const CREDENTIAL_OWNER = Symbol('CREDENTIAL_OWNER');

export const ABILITY = Symbol('ABILITY');

export const REQUEST_TENANT = Symbol('REQUEST_TENANT');

export const SESSION_CACHE = Symbol('SESSION_CACHE');

export const AUTH_FAILURE_LIMITER = Symbol('AUTH_FAILURE_LIMITER');
