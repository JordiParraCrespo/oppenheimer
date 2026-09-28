import type { WorkspaceLimits } from '../domain/automation-limits.policy';

export interface AutomationSettingsRepositoryPort {
  /** The workspace's row, or an empty set of overrides when it has none. */
  find(organizationId: string): Promise<WorkspaceLimits>;
  upsert(organizationId: string, limits: WorkspaceLimits): Promise<void>;
}
