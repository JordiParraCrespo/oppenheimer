import { TOKENS as KERNEL_TOKENS } from '@oppenheimer/frontend-core';

/**
 * DI tokens of the consumer product, on top of the kernel's. A consumer
 * service injects `TOKENS.AnalyticsService` (kernel) and
 * `TOKENS.SessionsRepository` (its own) through the one object.
 */
export const TOKENS = {
  ...KERNEL_TOKENS,
  ApiTokensRepository: Symbol.for('ApiTokensRepository'),
  ApiTokensService: Symbol.for('ApiTokensService'),
  HostsRepository: Symbol.for('HostsRepository'),
  HostsService: Symbol.for('HostsService'),
  InstallationsRepository: Symbol.for('InstallationsRepository'),
  InstallationsService: Symbol.for('InstallationsService'),
  OrganizationsRepository: Symbol.for('OrganizationsRepository'),
  OrganizationsService: Symbol.for('OrganizationsService'),
  ProfileRepository: Symbol.for('ProfileRepository'),
  ProfileService: Symbol.for('ProfileService'),
  SessionsRepository: Symbol.for('SessionsRepository'),
  SessionsService: Symbol.for('SessionsService'),
} as const;
