import type { SessionShare } from '@oppenheimer/frontend-consumer';
import { AppError } from '@oppenheimer/frontend-core';
import {
  type PutSessionShareDto,
  putSessionShareSchema,
  SESSION_SHARE_LIFETIME_MS,
  SESSION_SHARE_LIFETIMES,
  type SessionShareAccess,
  type SessionShareAudience,
  type SessionShareLifetime,
  sessionShareLifetimeAllowed,
} from '@oppenheimer/shared/schemas/session-share';
import { z } from 'zod';

/** A lifetime as the dialog offers it: the API's, and "never" for no expiry. */
export type ShareLifetimeChoice = SessionShareLifetime | 'never';

export const SHARE_LIFETIME_CHOICES: readonly ShareLifetimeChoice[] = [
  ...SESSION_SHARE_LIFETIMES,
  'never',
];

/** The Share dialog's values (`ShareSession.dc.html`): who, permission, for how long. */
export interface ShareSessionValues {
  audience: SessionShareAudience;
  /** Lowercased emails, in the order they were added. */
  people: string[];
  access: SessionShareAccess;
  /** `keep`, while adding people, leaves the share's own expiry as it is. */
  lifetime: ShareLifetimeChoice | 'keep';
  /** "I understand they act as me on this host", asked before write access. */
  ack: boolean;
}

/** A link only watches, whatever the form last held for access. */
export function effectiveAccess(
  audience: SessionShareAudience,
  access: SessionShareAccess,
): SessionShareAccess {
  return audience === 'link' ? 'read' : access;
}

/** Whether a lifetime may go with this access: write access ends within a day. */
export function lifetimeAllowed(
  access: SessionShareAccess,
  choice: ShareLifetimeChoice | 'keep',
): boolean {
  if (choice === 'keep') return true;
  return sessionShareLifetimeAllowed(access, choice === 'never' ? null : choice);
}

/** How long a lifetime is, or `null` for one that does not end. */
export function lifetimeMs(choice: ShareLifetimeChoice): number | null {
  return choice === 'never' ? null : SESSION_SHARE_LIFETIME_MS[choice];
}

/**
 * The dialog's values as the API takes them: the whole share for a `PUT`,
 * or, while adding people to a share whose who, permission and expiry are
 * all kept, only its people, so its expiry is not set again from now.
 */
export function shareInput(
  values: ShareSessionValues,
): { kind: 'put'; input: PutSessionShareDto } | { kind: 'people'; people: string[] } {
  if (values.lifetime === 'keep') return { kind: 'people', people: values.people };
  return {
    kind: 'put',
    input: {
      audience: values.audience,
      access: effectiveAccess(values.audience, values.access),
      ...(values.audience === 'people' ? { people: values.people } : {}),
      lifetime: values.lifetime === 'never' ? null : values.lifetime,
    },
  };
}

/** Whether these values still describe `share` in all but its people. */
export function keepsShare(values: ShareSessionValues, share: SessionShare | null): boolean {
  return (
    share !== null &&
    values.audience === share.audience &&
    effectiveAccess(values.audience, values.access) === share.access
  );
}

/**
 * Where the form starts: watching, for named people, for a day; or, to add
 * people to a share, what it already is, its expiry kept until another
 * length is picked. Write access asks again to be understood.
 */
export function shareDefaults(share: SessionShare | null): ShareSessionValues {
  if (!share)
    return { audience: 'people', people: [], access: 'read', lifetime: '24h', ack: false };
  return {
    audience: share.audience,
    people: share.people,
    access: share.access,
    lifetime: 'keep',
    ack: false,
  };
}

/**
 * The form's own shape over the shared vocabulary. What the request may hold
 * is the API's own schema, asked of the request the form would send, so the
 * rules on people and on lifetime are one rule on both sides; write access
 * also has to be understood before it is given.
 */
export function shareSessionFormSchema(
  messages: { people: string; ack: string; lifetime: string },
  share: SessionShare | null,
): z.ZodType<ShareSessionValues> {
  return z
    .object({
      audience: z.enum(['people', 'link']),
      people: z.array(z.string()),
      access: z.enum(['read', 'write']),
      lifetime: z.enum(['1h', '8h', '24h', '7d', 'never', 'keep']),
      ack: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (values.lifetime === 'keep' && !keepsShare(values, share)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lifetime'],
          message: messages.lifetime,
        });
      }
      // People are checked as a `PUT` would carry them, whatever is sent.
      const asPut = shareInput({ ...values, lifetime: '24h' });
      const parsed = asPut.kind === 'put' ? putSessionShareSchema.safeParse(asPut.input) : null;
      if (
        parsed &&
        !parsed.success &&
        parsed.error.issues.some((issue) => issue.path[0] === 'people')
      ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['people'], message: messages.people });
      }
      if (effectiveAccess(values.audience, values.access) === 'write' && !values.ack) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ack'], message: messages.ack });
      }
    });
}

/** Whether what someone typed is a whole email address. */
export function isEmail(text: string): boolean {
  return z.string().email().safeParse(text.trim()).success;
}

/** Two letters for an avatar: a name's initials, or an email's first two letters. */
export function initialsOf(nameOrEmail: string): string {
  const words = nameOrEmail.includes('@') ? [] : nameOrEmail.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return nameOrEmail
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();
}

/** A share's address. Opening it asks the guest to sign in, then judges them. */
export function shareUrl(origin: string, slug: string): string {
  return `${origin}/s/${slug}`;
}

/** Why a share did not open, by the API's code; a code not here is a failure to retry. */
const SHARE_REFUSALS = {
  SESSIONS_021: 'gone',
  SESSIONS_022: 'signIn',
  SESSIONS_023: 'notInvited',
} as const;

export type ShareRefusal = (typeof SHARE_REFUSALS)[keyof typeof SHARE_REFUSALS];

/** Why a share did not open, or `null` for a failure to retry. */
export function shareRefusalOf(error: unknown): ShareRefusal | null {
  if (!(error instanceof AppError)) return null;
  return SHARE_REFUSALS[error.code as keyof typeof SHARE_REFUSALS] ?? null;
}
