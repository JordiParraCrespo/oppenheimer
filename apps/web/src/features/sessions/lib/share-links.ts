import type { CreateShareLinkDto } from '@oppenheimer/shared/schemas/session-share';

/** The emails in what someone typed: split on commas, spaces and lines. */
export function peopleOf(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** The share form's values: people as typed, and "never" for no expiry. */
export interface ShareLinkValues {
  access: CreateShareLinkDto['access'];
  audience: CreateShareLinkDto['audience'];
  people: string;
  lifetime: NonNullable<CreateShareLinkDto['lifetime']> | 'never';
}

/** The share form's values as the API takes them. */
export function shareLinkInput(values: ShareLinkValues): CreateShareLinkDto {
  return {
    access: values.access,
    audience: values.audience,
    ...(values.audience === 'people' ? { people: peopleOf(values.people) } : {}),
    lifetime: values.lifetime === 'never' ? null : values.lifetime,
  };
}

/**
 * The address a link opens. The secret is the fragment: a browser sends no
 * fragment to any server, so it reaches no access log and no `Referer`.
 */
export function shareLinkUrl(origin: string, token: string): string {
  return `${origin}/shared#${token}`;
}

/** Where a link's secret waits while its holder signs in: this tab only. */
const PENDING_TOKEN_KEY = 'oppenheimer.shareToken';

/**
 * The secret this page was opened with: the fragment, or, back from signing
 * in, the one {@link keepShareToken} set aside — put back in the fragment so
 * a reload still opens it. A sign-in's `?redirect=` would have carried it in
 * a query string, which is what the fragment exists to avoid.
 */
export function readShareToken(): string | null {
  const fromHash = window.location.hash.slice(1);
  if (fromHash) return fromHash;
  try {
    const kept = window.sessionStorage.getItem(PENDING_TOKEN_KEY);
    if (!kept) return null;
    window.sessionStorage.removeItem(PENDING_TOKEN_KEY);
    window.history.replaceState(null, '', `${window.location.pathname}#${kept}`);
    return kept;
  } catch {
    // Storage refused (a private window): the holder opens the link again.
    return null;
  }
}

/** Set the secret aside for the trip through sign-in. */
export function keepShareToken(token: string): void {
  try {
    window.sessionStorage.setItem(PENDING_TOKEN_KEY, token);
  } catch {
    // Storage refused: after signing in, the holder opens the link again.
  }
}

/** Why a link did not open, from the API's answer, or `null` for a failure to retry. */
export function shareRefusalOf(error: unknown): 'gone' | 'sign_in' | 'not_invited' | null {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case 'SESSIONS_021':
      return 'gone';
    case 'SESSIONS_022':
      return 'sign_in';
    case 'SESSIONS_023':
      return 'not_invited';
    default:
      return null;
  }
}
