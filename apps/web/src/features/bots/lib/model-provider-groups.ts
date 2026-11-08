/**
 * The cards Settings → Model providers splits its rows into, in the order they
 * are drawn. Each id names its heading (`settings.modelProviders.groups.<id>`)
 * and decides which rows it holds.
 */
const MODEL_PROVIDER_GROUPS = [
  { id: 'connected', holds: (configured: boolean) => configured },
  { id: 'notConnected', holds: (configured: boolean) => !configured },
] as const;

export type ModelProviderGroupId = (typeof MODEL_PROVIDER_GROUPS)[number]['id'];

/** `rows` split into the groups, in catalog order within each; empty groups left out. */
export function groupModelProviders<Row extends { configured: boolean }>(
  rows: readonly Row[],
): { id: ModelProviderGroupId; rows: Row[] }[] {
  return MODEL_PROVIDER_GROUPS.map(({ id, holds }) => ({
    id,
    rows: rows.filter((row) => holds(row.configured)),
  })).filter((group) => group.rows.length > 0);
}
