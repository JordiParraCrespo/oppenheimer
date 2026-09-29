/**
 * DI tokens for the admin module. The use cases inject the port through its
 * token, so they depend on `AdminAuthPort`, not on the Better Auth gateway.
 */
export const ADMIN_AUTH = Symbol('ADMIN_AUTH');
