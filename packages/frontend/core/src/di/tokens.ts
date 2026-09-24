/**
 * DI tokens of the kernel: what every product package and every app can rely
 * on being bound. A product package declares its own tokens next to its
 * modules (`@oppenheimer/frontend-consumer`) and spreads
 * these in, so a product service injects `TOKENS.AnalyticsService` the same
 * way a kernel one does.
 */
export const TOKENS = {
  StorageService: Symbol.for('StorageService'),
  AnalyticsClient: Symbol.for('AnalyticsClient'),
  AnalyticsService: Symbol.for('AnalyticsService'),
  AuthClient: Symbol.for('AuthClient'),
  AuthRepository: Symbol.for('AuthRepository'),
  AuthStore: Symbol.for('AuthStore'),
  AuthService: Symbol.for('AuthService'),
  CapabilitiesRepository: Symbol.for('CapabilitiesRepository'),
  CapabilitiesService: Symbol.for('CapabilitiesService'),
  UserRepository: Symbol.for('UserRepository'),
  UsersService: Symbol.for('UsersService'),
  UserSettingsRepository: Symbol.for('UserSettingsRepository'),
  UserSettingsService: Symbol.for('UserSettingsService'),
} as const;
