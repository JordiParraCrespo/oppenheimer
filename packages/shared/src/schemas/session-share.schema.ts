import { z } from 'zod';

/**
 * A share link opens one session's terminal to people outside its workspace
 * (`product/versions/mvp/21-session-share-links.md`).
 *
 * Two independent choices make a link: **what** the holder may do, and **who**
 * may hold it.
 *
 * - `access`: `read` watches the terminal (tmux attaches a read-only client
 *   and the relay drops its keystrokes); `write` types into it, which is a
 *   shell on the host as the person who shared it.
 * - `audience`: `anyone` with the link, signed in or not; `accounts`, anyone
 *   signed in to Oppenheimer; `people`, only the accounts whose email is on
 *   the link's list.
 */
export const SHARE_LINK_ACCESS = ['read', 'write'] as const;
export const shareLinkAccessSchema = z.enum(SHARE_LINK_ACCESS);
export type ShareLinkAccess = z.infer<typeof shareLinkAccessSchema>;

export const SHARE_LINK_AUDIENCES = ['anyone', 'accounts', 'people'] as const;
export const shareLinkAudienceSchema = z.enum(SHARE_LINK_AUDIENCES);
export type ShareLinkAudience = z.infer<typeof shareLinkAudienceSchema>;

/** How long a new link lives; `null` is until it is revoked or the session closes. */
export const SHARE_LINK_LIFETIMES = ['1h', '1d', '7d', '30d'] as const;
export const shareLinkLifetimeSchema = z.enum(SHARE_LINK_LIFETIMES);
export type ShareLinkLifetime = z.infer<typeof shareLinkLifetimeSchema>;

export const SHARE_LINK_LIFETIME_MS: Record<ShareLinkLifetime, number> = {
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/** The most people one link names: a list longer than this is an audience of `accounts`. */
export const MAX_SHARE_LINK_PEOPLE = 50;

/** The most live links one session holds at once. */
export const MAX_SHARE_LINKS_PER_SESSION = 20;

/** `POST /sessions/{id}/share-links`. */
export const createShareLinkSchema = z
  .object({
    access: shareLinkAccessSchema,
    audience: shareLinkAudienceSchema,
    /** Emails of the accounts that may open it; only with `audience: 'people'`. */
    people: z
      .array(z.string().trim().toLowerCase().email().max(320))
      .max(MAX_SHARE_LINK_PEOPLE)
      .optional(),
    lifetime: shareLinkLifetimeSchema.nullable().optional(),
    label: z.string().trim().max(80).optional(),
  })
  .refine((link) => link.audience !== 'people' || (link.people?.length ?? 0) > 0, {
    params: { i18nKey: 'validation.required' },
    path: ['people'],
  })
  // Only a link for specific people names people: a list on any other
  // audience would read as a restriction that is not enforced.
  .refine((link) => link.audience === 'people' || !link.people?.length, {
    path: ['people'],
  });

export type CreateShareLinkDto = z.infer<typeof createShareLinkSchema>;

/**
 * The link's secret, as the console carries it: in the URL **fragment**
 * (`/shared#<token>`), which a browser never sends to a server, and from there
 * in a request body, never a path or a query string a proxy would log.
 */
export const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** `POST /shared-sessions/lookup`. */
export const findSharedSessionSchema = z.object({
  token: shareTokenSchema,
});

export type FindSharedSessionDto = z.infer<typeof findSharedSessionSchema>;

/**
 * `POST /shared-sessions/attach-ticket`. No window: a link opens the agent's
 * (window 0) and nothing else, so a holder cannot reach a shell window
 * opened beside it.
 */
export const issueSharedAttachTicketSchema = z.object({
  token: shareTokenSchema,
});

export type IssueSharedAttachTicketDto = z.infer<typeof issueSharedAttachTicketSchema>;
