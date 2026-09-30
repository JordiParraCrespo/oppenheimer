/**
 * The two tags every machine and its disks carry. IAM on every provider is
 * scoped to the first; the sweeper joins on the second. Alibaba rejects keys
 * starting with `aliyun` or `acs:`, so the prefix is ours.
 */
export const MANAGED_TAG = { key: 'oppenheimer:managed', value: 'true' } as const;
export const MACHINE_TAG_KEY = 'oppenheimer:machine';
export const NETWORK_TAG = { key: 'oppenheimer:network', value: 'true' } as const;

export function machineTags(
  machineId: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return { ...extra, [MANAGED_TAG.key]: MANAGED_TAG.value, [MACHINE_TAG_KEY]: machineId };
}
