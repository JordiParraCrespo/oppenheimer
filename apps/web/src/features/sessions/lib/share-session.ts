import type { SessionShare } from '@oppenheimer/frontend-consumer';
import { AppError } from '@oppenheimer/frontend-core';
import { formatTimeAway } from '@oppenheimer/frontend-web';
import {
  type PutSessionShareDto,
  SESSION_SHARE_LIFETIME_MS,
  SESSION_SHARE_LIFETIMES,
  type SessionShareAccess,
  type SessionShareAudience,
  type SessionShareLifetime,
  sessionShareLifetimeAllowed,
} from '@oppenheimer/shared/schemas/session-share';
import type { TFunction } from 'i18next';
import { z } from 'zod';

/** A lifetime as Share offers it: the API's, and "never" for no expiry. */
export type ShareLifetimeChoice = SessionShareLifetime | 'never';

export const SHARE_LIFETIME_CHOICES: readonly ShareLifetimeChoice[] = [
  ...SESSION_SHARE_LIFETIMES,
  'never',
];

/** How a session is shared, or is about to be: who, what they may do, for how long. */
export interface ShareSettings {
  audience: SessionShareAudience;
  access: SessionShareAccess;
  lifetime: ShareLifetimeChoice;
}

/** Where a session not yet shared starts: watching, for people you invite, for a day. */
export const SHARE_DEFAULTS: ShareSettings = {
  audience: 'people',
  access: 'read',
  lifetime: '24h',
};

/** A link only watches, whatever was last picked for access. */
export function effectiveAccess(
  audience: SessionShareAudience,
  access: SessionShareAccess,
): SessionShareAccess {
  return audience === 'link' ? 'read' : access;
}

/** Whether a lifetime may go with this access: write access ends within a day. */
export function lifetimeAllowed(access: SessionShareAccess, choice: ShareLifetimeChoice): boolean {
  return sessionShareLifetimeAllowed(access, choice === 'never' ? null : choice);
}

/** How long a lifetime is, or `null` for one that does not end. */
export function lifetimeMs(choice: ShareLifetimeChoice): number | null {
  return choice === 'never' ? null : SESSION_SHARE_LIFETIME_MS[choice];
}

/**
 * The shortest lifetime this access may have that still covers what a share
 * has left (`null`: it does not end), so changing who or what does not cut a
 * share short. Write never outlasts a day, so a longer share turned to write
 * ends in one.
 */
export function lifetimeCovering(
  access: SessionShareAccess,
  remainingMs: number | null,
): ShareLifetimeChoice {
  const allowed = SHARE_LIFETIME_CHOICES.filter((choice) => lifetimeAllowed(access, choice));
  if (remainingMs === null) return allowed[allowed.length - 1];
  return (
    allowed.find((choice) => {
      const ms = lifetimeMs(choice);
      return ms === null || ms >= remainingMs;
    }) ?? allowed[allowed.length - 1]
  );
}

/**
 * A pick of access, made consistent: write starts on its shortest lifetime,
 * as a share that types is a shell as its owner; watching keeps the lifetime.
 */
export function withAccess(settings: ShareSettings, access: SessionShareAccess): ShareSettings {
  if (access === 'write' && settings.access !== 'write') {
    return { ...settings, access, lifetime: '1h' };
  }
  return { ...settings, access };
}

/** The people named, with a whole address still typed in the field. */
export function namedPeople(values: { people: string[]; typed: string }): string[] {
  const typed = values.typed.trim().toLowerCase();
  return isEmail(typed) && !values.people.includes(typed)
    ? [...values.people, typed]
    : values.people;
}

/** What the API takes to share as `settings`, with `people` for a share for specific people. */
export function shareInput(settings: ShareSettings, people: string[]): PutSessionShareDto {
  const access = effectiveAccess(settings.audience, settings.access);
  const lifetime = lifetimeAllowed(access, settings.lifetime) ? settings.lifetime : '1h';
  return {
    audience: settings.audience,
    access,
    ...(settings.audience === 'people' ? { people } : {}),
    lifetime: lifetime === 'never' ? null : lifetime,
  };
}

/**
 * A live share's settings, its lifetime the shortest that covers what it has
 * left, so sharing it again with one thing changed keeps the rest.
 */
export function settingsOf(share: SessionShare, now: number): ShareSettings {
  const remaining = share.expiresAt === null ? null : share.expiresAt.getTime() - now;
  return {
    audience: share.audience,
    access: share.access,
    lifetime: lifetimeCovering(share.access, remaining),
  };
}

/** Whether what someone typed is a whole email address. */
function isEmail(text: string): boolean {
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

const HOUR_MS = 60 * 60 * 1000;

/**
 * How long a share has left, as its rows and the guest's bar write it: whole
 * minutes under an hour ("59m"), two units past it ("23h 41m", "6d 23h"). The
 * clocks that draw it move once a minute, so it never shows seconds.
 */
export function shareTimeLeft(ms: number, locale: string, t: TFunction): string {
  if (ms < HOUR_MS)
    return t('common.relative.minute', { count: Math.max(1, Math.floor(ms / 60_000)) });
  return formatTimeAway(ms, locale);
}
