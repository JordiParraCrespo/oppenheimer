import { createHash } from 'node:crypto';
import type { HostFactsDto } from '@oppenheimer/shared';
import type { HostInventory, HostTimelineEntry } from './host-metadata.types';

/**
 * The facts that change between heartbeats. They are presence, not inventory,
 * and are left out of the hash — otherwise every beat would be a "change" and
 * the inventory would be rewritten as often as the old `host` row was.
 */
const LIVE_FACTS = ['diskFreeBytes'] as const;

/** The promoted fields a timeline diff reports, in the order a person reads them. */
const DIFFED = [
  'osName',
  'osVersion',
  'kernelVersion',
  'hostname',
  'arch',
  'cpuModel',
  'cpuCount',
  'memoryTotalBytes',
  'diskTotalBytes',
  'virtualization',
  'cloudProvider',
  'timezone',
  'bootedAt',
  'serviceManager',
  'channel',
] as const satisfies readonly (keyof HostInventory)[];

/**
 * The static facts as a canonical string: keys sorted at every level, live
 * numbers removed. Two reports of the same machine hash the same whatever
 * order the runner marshalled them in.
 */
export function staticFactsOf(facts: HostFactsDto): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...facts };
  for (const key of LIVE_FACTS) delete copy[key];
  return copy;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** SHA-256, hex, of the canonical static facts. Channel is hashed separately; see below. */
export function factsHashOf(facts: HostFactsDto): string {
  return createHash('sha256')
    .update(canonical(staticFactsOf(facts)))
    .digest('hex');
}

/**
 * The inventory a report describes.
 *
 * `channel` is not in the facts: the heartbeat carries it and the hello does
 * not. It is kept out of the hash so a hello cannot flip the inventory back and
 * forth, and `null` here means "not reported this time", which the repository
 * reads as "keep the one on file".
 */
export function inventoryFromFacts(facts: HostFactsDto, channel: string | null): HostInventory {
  return {
    factsHash: factsHashOf(facts),
    platform: facts.platform,
    osName: facts.osName ?? null,
    osVersion: facts.osVersion || null,
    kernelVersion: facts.kernelVersion ?? null,
    arch: facts.arch,
    hostname: facts.hostname,
    cpuModel: facts.cpuModel ?? null,
    cpuCount: facts.cpus ?? null,
    memoryTotalBytes: facts.memoryTotalBytes ?? null,
    diskTotalBytes: facts.diskTotalBytes ?? null,
    virtualization: facts.virtualization ?? null,
    cloudProvider: facts.cloudProvider ?? null,
    timezone: facts.timezone ?? null,
    bootedAt: facts.bootedAt ? new Date(facts.bootedAt) : null,
    runnerVersion: facts.runnerVersion,
    channel,
    serviceManager: facts.serviceManager ?? null,
    tools: facts.tools,
    facts: staticFactsOf(facts),
  };
}

function comparable(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function toolsSummary(tools: HostInventory['tools']): Record<string, string | null> {
  return Object.fromEntries(
    tools.map((tool) => [tool.name, tool.path ? (tool.version ?? '') : null]),
  );
}

/**
 * What changed between two inventories, as timeline entries.
 *
 * A new runner version is its own entry (`runner_updated`), because the update
 * story reads it on its own (09 §5); everything else that changed is one
 * `facts_changed` with a `{ field: [before, after] }` diff, tools summarised as
 * name → version (null when missing). A field that was unknown before is not a
 * change, and no previous inventory is no entry: the `paired` entry already
 * described the machine.
 */
export function inventoryChanges(
  before: HostInventory | null,
  after: HostInventory,
): HostTimelineEntry[] {
  if (!before) return [];
  const entries: HostTimelineEntry[] = [];
  if (before.runnerVersion !== after.runnerVersion) {
    entries.push({
      kind: 'runner_updated',
      payload: { from: before.runnerVersion, to: after.runnerVersion },
    });
  }
  const changed: Record<string, [unknown, unknown]> = {};
  for (const field of DIFFED) {
    const was = comparable(before[field]);
    const now = comparable(after[field]);
    // Unknown → known is learning, not a change: a runner upgrade that starts
    // reporting a field, or the first report after the backfill, whose rows
    // carry only what the old columns held. A null channel on the new side is
    // "not reported this time", never a change either.
    if (was === null) continue;
    if (field === 'channel' && now === null) continue;
    if (was !== now) changed[field] = [was, now];
  }
  const toolsBefore = toolsSummary(before.tools);
  const toolsAfter = toolsSummary(after.tools);
  if (canonical(toolsBefore) !== canonical(toolsAfter)) changed.tools = [toolsBefore, toolsAfter];
  if (Object.keys(changed).length > 0) {
    entries.push({ kind: 'facts_changed', payload: { changed } });
  }
  return entries;
}
