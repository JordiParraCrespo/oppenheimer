import { TOKENS as KERNEL_TOKENS } from '@oppenheimer/frontend-core';

/** DI tokens of the consumer product, on top of the kernel's. */
export const TOKENS = {
  ...KERNEL_TOKENS,
  PermissionsRepository: Symbol.for('PermissionsRepository'),
  AutomationsRepository: Symbol.for('AutomationsRepository'),
  HostsRepository: Symbol.for('HostsRepository'),
  InstallationsRepository: Symbol.for('InstallationsRepository'),
  OrganizationsRepository: Symbol.for('OrganizationsRepository'),
  OrganizationsService: Symbol.for('OrganizationsService'),
  ProfileRepository: Symbol.for('ProfileRepository'),
  ProfileService: Symbol.for('ProfileService'),
  ProjectsRepository: Symbol.for('ProjectsRepository'),
  PullRequestsRepository: Symbol.for('PullRequestsRepository'),
  SessionsRepository: Symbol.for('SessionsRepository'),
  SessionsService: Symbol.for('SessionsService'),
  TasksRepository: Symbol.for('TasksRepository'),
  CalendarRepository: Symbol.for('CalendarRepository'),
} as const;
