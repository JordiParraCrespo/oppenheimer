import { sanitizeRedirect, searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/**
 * Sign-in's search. `redirect` is where to go after, sanitised so an absolute
 * or protocol-relative value cannot send anyone off-site; `email` prefills the
 * form for an invitee who already has an account; `error` is the code Better
 * Auth appends when a social round trip fails and comes back here.
 */
export const loginSearchSchema = z.object({
  redirect: z.unknown().transform(sanitizeRedirect),
  email: searchText,
  error: searchText,
});

/**
 * Sign-up's search: `error`, set two ways, both a redirect the app never saw —
 * sign-in forwards a `signup_disabled` here, and a failed social sign-up comes
 * straight back with its own code.
 */
export const registerSearchSchema = z.object({ error: searchText });

/** The reset link's token, or the error Better Auth sends instead, and the address it was for. */
export const resetPasswordSearchSchema = z.object({
  token: searchText,
  error: searchText,
  email: searchText,
});
