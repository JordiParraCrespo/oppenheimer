import type { BetterAuthOptions } from 'better-auth';

type UserAdditionalFields = NonNullable<NonNullable<BetterAuthOptions['user']>['additionalFields']>;

/**
 * The extra columns on Better Auth's `user` table, declared once for both
 * sides: the server passes this to `user.additionalFields` and the clients to
 * `inferAdditionalFields`, so a field added on one side cannot be silently
 * forgotten on the other.
 *
 * `as const` keeps the `required`/`input` flags as literal types — Better
 * Auth's type inference branches on them to decide which fields are sign-up
 * input and which are optional on the session user.
 */
export const userAdditionalFields = {
  firstName: { type: 'string', required: true, input: true },
  lastName: { type: 'string', required: true, input: true },
  // Profile fields the user edits from the profile screen. `input: false`
  // keeps them out of sign-up: they are set through `PATCH /profile`, which
  // validates them, rather than accepted unchecked on the public sign-up route.
  phone: { type: 'string', required: false, input: false },
  jobTitle: { type: 'string', required: false, input: false },
  // Server-managed fields: never part of sign-up input.
  role: {
    type: 'string',
    required: false,
    defaultValue: 'user',
    input: false,
  },
  isActive: {
    type: 'boolean',
    required: false,
    defaultValue: true,
    input: false,
  },
} as const satisfies UserAdditionalFields;
