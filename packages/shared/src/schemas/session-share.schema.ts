import { z } from 'zod';

/**
 * Sharing a session opens its terminal to people outside its workspace
 * (`product/versions/mvp/21-session-share-links.md`). A session has at most
 * one share, at one stable address, `/s/<slug>`.
 *
 * Three choices make a share: **who** may open it, **what** they may do, and
 * **for how long**.
 *
 * - `audience`: `people`, only the accounts whose verified email is on the
 *   share's list; `link`, anyone signed in who has the address. Opening a
 *   share always needs an account.
 * - `access`: `read` watches the terminal (tmux attaches a read-only client
 *   and the relay drops its keystrokes); `write` types into it, which is a
 *   shell on the host as the person who shared it. Only named people may
 *   write, and never for more than a day.
 */
export const SESSION_SHARE_ACCESS = ['read', 'write'] as const;
export const sessionShareAccessSchema = z.enum(SESSION_SHARE_ACCESS);
export type SessionShareAccess = z.infer<typeof sessionShareAccessSchema>;

export const SESSION_SHARE_AUDIENCES = ['people', 'link'] as const;
export const sessionShareAudienceSchema = z.enum(SESSION_SHARE_AUDIENCES);
export type SessionShareAudience = z.infer<typeof sessionShareAudienceSchema>;

/** How long a share lasts; `null` is until its owner stops sharing. */
export const SESSION_SHARE_LIFETIMES = ['1h', '8h', '24h', '7d'] as const;
export const sessionShareLifetimeSchema = z.enum(SESSION_SHARE_LIFETIMES);
export type SessionShareLifetime = z.infer<typeof sessionShareLifetimeSchema>;

export const SESSION_SHARE_LIFETIME_MS: Record<SessionShareLifetime, number> = {
  '1h': 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

/**
 * The lifetimes write access may have: a share that types is a shell as its
 * owner, so it ends within a day and is never "until I stop".
 */
export const WRITE_SHARE_LIFETIMES = [
  '1h',
  '8h',
  '24h',
] as const satisfies readonly SessionShareLifetime[];

/** The longest write access lasts, in milliseconds. */
export const WRITE_SHARE_MAX_MS = SESSION_SHARE_LIFETIME_MS['24h'];

/** Whether `lifetime` (`null`: no expiry) may go with `access`. */
export function sessionShareLifetimeAllowed(
  access: SessionShareAccess,
  lifetime: SessionShareLifetime | null | undefined,
): boolean {
  if (access === 'read') return true;
  return lifetime != null && (WRITE_SHARE_LIFETIMES as readonly string[]).includes(lifetime);
}

/** The most people one share names. */
export const MAX_SESSION_SHARE_PEOPLE = 50;

const shareEmailSchema = z.string().trim().toLowerCase().email().max(320);

/** `PUT /sessions/{id}/share`: share the session, or replace how it is shared. */
export const putSessionShareSchema = z
  .object({
    audience: sessionShareAudienceSchema,
    access: sessionShareAccessSchema,
    /** Emails of the accounts that may open it; only with `audience: 'people'`. */
    people: z.array(shareEmailSchema).max(MAX_SESSION_SHARE_PEOPLE).optional(),
    lifetime: sessionShareLifetimeSchema.nullable(),
  })
  .refine((share) => share.audience !== 'people' || (share.people?.length ?? 0) > 0, {
    params: { i18nKey: 'validation.required' },
    path: ['people'],
  })
  // Only a share for specific people names people: a list on a link would
  // read as a restriction that is not enforced.
  .refine((share) => share.audience === 'people' || !share.people?.length, {
    path: ['people'],
  })
  .refine((share) => share.audience === 'people' || share.access === 'read', {
    params: { i18nKey: 'validation.invalid' },
    path: ['access'],
  })
  .refine((share) => sessionShareLifetimeAllowed(share.access, share.lifetime), {
    params: { i18nKey: 'validation.invalid' },
    path: ['lifetime'],
  });

export type PutSessionShareDto = z.infer<typeof putSessionShareSchema>;

/**
 * `PATCH /sessions/{id}/share/people`: the people a `people` share names,
 * with nothing else changed. Removing the last one is stopping the share.
 */
export const setSessionSharePeopleSchema = z.object({
  people: z.array(shareEmailSchema).min(1).max(MAX_SESSION_SHARE_PEOPLE),
});

export type SetSessionSharePeopleDto = z.infer<typeof setSessionSharePeopleSchema>;

/** A share's address, `/s/<slug>`: 128 random bits, in base64url. */
export const sessionShareSlugSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);

/** `POST /shared-sessions/lookup`. */
export const findSharedSessionSchema = z.object({
  slug: sessionShareSlugSchema,
});

export type FindSharedSessionDto = z.infer<typeof findSharedSessionSchema>;

/**
 * `POST /shared-sessions/attach-ticket`. No window: a share opens the agent's
 * (window 0) and nothing else, so a guest cannot reach a shell window opened
 * beside it.
 */
export const issueSharedAttachTicketSchema = z.object({
  slug: sessionShareSlugSchema,
});

export type IssueSharedAttachTicketDto = z.infer<typeof issueSharedAttachTicketSchema>;
