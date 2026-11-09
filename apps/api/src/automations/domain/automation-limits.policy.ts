import type { AutomationOverlapPolicy } from '@oppenheimer/shared/automations';

/**
 * The three-level configuration (§Configuration): the tightest of the platform
 * ceiling, the workspace's setting and the automation's own wins. One pure
 * resolver, read by every guard, so nothing hard-codes a number.
 */
export interface AutomationLimits {
  maxRunsPerAutomationHour: number;
  maxRunsPerWorkspaceHour: number;
  liveRunsPerHost: number;
  overlap: AutomationOverlapPolicy;
  staleTtlSeconds: number;
  missedGraceSeconds: number;
  maxRunSeconds: number;
  /** A host reporting less free disk than this is not given a run: a worktree needs room. */
  diskFloorBytes: number;
  /**
   * The spend guard on a bot's routines (`26-bot-routines.md` §6): reports
   * its owner has not seen before they stop, and how long the owner may be
   * away from the bot's chat. A workspace's preference, with no ceiling.
   */
  unattendedReports: number;
  unattendedAwaySeconds: number;
}

/** The platform's defaults (what a workspace gets) and ceilings (what nobody exceeds). */
export interface PlatformLimits {
  defaults: AutomationLimits;
  ceilings: Omit<
    AutomationLimits,
    | 'overlap'
    | 'missedGraceSeconds'
    | 'diskFloorBytes'
    | 'unattendedReports'
    | 'unattendedAwaySeconds'
  >;
}

/** The workspace row: every field optional, null is the platform default. */
export type WorkspaceLimits = Partial<{
  [K in keyof AutomationLimits]: AutomationLimits[K] | null;
}>;

export interface AutomationOverrides {
  maxRunsPerHour: number | null;
  overlap: AutomationOverlapPolicy | null;
}

export const DEFAULT_PLATFORM_LIMITS: PlatformLimits = {
  defaults: {
    maxRunsPerAutomationHour: 10,
    maxRunsPerWorkspaceHour: 100,
    liveRunsPerHost: 2,
    overlap: 'skip',
    staleTtlSeconds: 60 * 60,
    missedGraceSeconds: 15 * 60,
    maxRunSeconds: 60 * 60,
    diskFloorBytes: 5 * 1024 ** 3,
    unattendedReports: 3,
    unattendedAwaySeconds: 72 * 60 * 60,
  },
  ceilings: {
    maxRunsPerAutomationHour: 60,
    maxRunsPerWorkspaceHour: 500,
    liveRunsPerHost: 20,
    staleTtlSeconds: 24 * 60 * 60,
    maxRunSeconds: 6 * 60 * 60,
  },
};

function tightest(ceiling: number, ...values: (number | null | undefined)[]): number {
  let value = ceiling;
  for (const candidate of values) {
    if (typeof candidate === 'number' && candidate > 0) value = Math.min(value, candidate);
  }
  return value;
}

export function resolveAutomationLimits(
  platform: PlatformLimits,
  workspace: WorkspaceLimits,
  automation: AutomationOverrides,
): AutomationLimits {
  const { defaults, ceilings } = platform;
  return {
    maxRunsPerAutomationHour: tightest(
      ceilings.maxRunsPerAutomationHour,
      workspace.maxRunsPerAutomationHour ?? defaults.maxRunsPerAutomationHour,
      automation.maxRunsPerHour,
    ),
    maxRunsPerWorkspaceHour: tightest(
      ceilings.maxRunsPerWorkspaceHour,
      workspace.maxRunsPerWorkspaceHour ?? defaults.maxRunsPerWorkspaceHour,
    ),
    liveRunsPerHost: tightest(
      ceilings.liveRunsPerHost,
      workspace.liveRunsPerHost ?? defaults.liveRunsPerHost,
    ),
    overlap: automation.overlap ?? workspace.overlap ?? defaults.overlap,
    staleTtlSeconds: tightest(
      ceilings.staleTtlSeconds,
      workspace.staleTtlSeconds ?? defaults.staleTtlSeconds,
    ),
    missedGraceSeconds: workspace.missedGraceSeconds ?? defaults.missedGraceSeconds,
    maxRunSeconds: tightest(
      ceilings.maxRunSeconds,
      workspace.maxRunSeconds ?? defaults.maxRunSeconds,
    ),
    // The deployment's, not a workspace's: the machine's floor is not a preference.
    diskFloorBytes: defaults.diskFloorBytes,
    unattendedReports: workspace.unattendedReports ?? defaults.unattendedReports,
    unattendedAwaySeconds: workspace.unattendedAwaySeconds ?? defaults.unattendedAwaySeconds,
  };
}
