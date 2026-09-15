import type { Locale, TableDensity, Theme } from '@oppenheimer/shared/schemas/profile';

/**
 * The signed-in user's own account, as the profile screen needs it.
 *
 * Distinct from `UserEntity` (the directory) because it carries contact details
 * only the account's owner is shown, and because the screens differ: one is
 * "me", the other is "someone".
 */
export class ProfileEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly phone: string | null,
    public readonly jobTitle: string | null,
    public readonly avatarUrl: string | null,
    public readonly role: string,
    public readonly emailVerified: boolean,
    public readonly twoFactorEnabled: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /** Fallback for the avatar: the initials shown when there is no picture. */
  get initials(): string {
    const first = this.firstName.trim().charAt(0);
    const last = this.lastName.trim().charAt(0);
    return `${first}${last}`.toUpperCase();
  }
}

/** A user's workspace preferences. */
export class UserSettingsEntity {
  constructor(
    public readonly userId: string,
    public readonly theme: Theme,
    public readonly locale: Locale,
    public readonly density: TableDensity,
    public readonly weeklyDigest: boolean,
    public readonly productUpdates: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}

/** One device signed in to the account. */
export class UserSessionEntity {
  constructor(
    public readonly id: string,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    /** True for the session this app is using — it cannot be revoked. */
    public readonly current: boolean,
    public readonly createdAt: Date,
    public readonly lastSeenAt: Date,
    public readonly expiresAt: Date,
  ) {}

  /**
   * Whether the row should be drawn with a phone or a monitor.
   *
   * Read off the user agent, which is the only thing the server knows about the
   * device — the session list is a "do you recognise this?" prompt, and the
   * shape of the icon is most of what answers it at a glance.
   */
  get deviceKind(): 'mobile' | 'desktop' {
    return /android|iphone|ipad|ipod|mobile/i.test(this.userAgent ?? '') ? 'mobile' : 'desktop';
  }

  /**
   * The device named the way the user would name it: platform, then browser.
   *
   * Deliberately coarse. A full user-agent parser is a dependency and a
   * liability, and the extra precision buys nothing here — "Windows · Chrome"
   * is already enough to recognise your own laptop or spot one that is not
   * yours. An agent nothing matches yields `null`, and the screen says so in
   * its own words rather than printing a raw agent string at the user.
   */
  get deviceLabel(): string | null {
    const agent = this.userAgent;
    if (!agent) return null;

    const platform = PLATFORM_PATTERNS.find(([, pattern]) => pattern.test(agent))?.[0] ?? null;
    const browser = BROWSER_PATTERNS.find(([, pattern]) => pattern.test(agent))?.[0] ?? null;

    if (!platform && !browser) return null;
    return [platform, browser].filter(Boolean).join(' · ');
  }
}

/**
 * Ordered most specific first: iPadOS agents also say "Macintosh", and every
 * Chromium browser still claims to be Safari, so the first match has to win.
 */
const PLATFORM_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ['iPadOS', /ipad/i],
  ['iOS', /iphone|ipod/i],
  ['Android', /android/i],
  ['macOS', /macintosh|mac os x/i],
  ['Windows', /windows/i],
  ['Linux', /linux|x11/i],
];

const BROWSER_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ['Edge', /edg[ea]?\//i],
  ['Opera', /opr\/|opera/i],
  ['Firefox', /firefox\/|fxios\//i],
  ['Chrome', /chrome\/|crios\//i],
  ['Safari', /safari\//i],
];
