/**
 * DI tokens for the auth module.
 *
 * `auth` is `@Global`, so what it binds here is the whole application's way of
 * asking these questions. Other modules inject the token and depend on the
 * port beside it — never on the adapter, which is where Better Auth lives.
 */

/** Mints and reuses a session so a scoped credential can act as its owner. */
export const DELEGATED_SESSION = Symbol('DELEGATED_SESSION');

/** Turns the credential on a request into a scope context. */
export const CREDENTIAL_SCOPE = Symbol('CREDENTIAL_SCOPE');

/** Verifies a presented credential against the identity provider. */
export const CREDENTIAL_VERIFIER = Symbol('CREDENTIAL_VERIFIER');
