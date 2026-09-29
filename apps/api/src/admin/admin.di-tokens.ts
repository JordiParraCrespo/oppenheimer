/**
 * Use cases inject the port through this token, so they depend on
 * `AdminAuthPort`, never on the Better Auth gateway behind it.
 */
export const ADMIN_AUTH = Symbol('ADMIN_AUTH');
