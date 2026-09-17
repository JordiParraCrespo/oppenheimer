import type { Locale, TableDensity, Theme } from '@oppenheimer/shared/schemas/profile';

/**
 * A user's own preferences: theme, language, table density, digests.
 *
 * Kernel, not product: every app applies the theme and the language on start,
 * whichever product it is, so both the consumer and the control plane read
 * this through the same hook.
 */
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
