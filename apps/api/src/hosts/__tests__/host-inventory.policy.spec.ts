import type { HostFactsDto } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { factsHashOf, inventoryChanges, inventoryFromFacts } from '../domain/host-inventory.policy';

const facts: HostFactsDto = {
  platform: 'ubuntu',
  osVersion: '24.04',
  arch: 'amd64',
  hostname: 'optimus',
  user: 'jordi',
  home: '/home/jordi',
  root: false,
  tools: [{ name: 'git', path: '/usr/bin/git', version: '2.45.0', required: true }],
  workspacePath: '/home/jordi/oppenheimer-ai',
  diskFreeBytes: 120_000_000_000,
  cpus: 32,
  runnerVersion: '0.14.2',
  osName: 'Ubuntu 24.04.1 LTS',
  memoryTotalBytes: 68_719_476_736,
  bootedAt: '2026-09-20T08:14:03Z',
};

describe('factsHashOf', () => {
  it('ignores free disk, so a heartbeat is not a change to the machine', () => {
    expect(factsHashOf({ ...facts, diskFreeBytes: 1 })).toBe(factsHashOf(facts));
  });

  it('ignores the order the runner marshalled the keys in', () => {
    const reordered = Object.fromEntries(Object.entries(facts).reverse()) as HostFactsDto;
    expect(factsHashOf(reordered)).toBe(factsHashOf(facts));
  });

  it('moves when the machine does', () => {
    expect(factsHashOf({ ...facts, cpus: 16 })).not.toBe(factsHashOf(facts));
    expect(factsHashOf({ ...facts, tools: [] })).not.toBe(factsHashOf(facts));
  });
});

describe('inventoryFromFacts', () => {
  it('promotes the named fields and keeps the static report', () => {
    const inventory = inventoryFromFacts(facts, 'stable');
    expect(inventory).toMatchObject({
      platform: 'ubuntu',
      osName: 'Ubuntu 24.04.1 LTS',
      cpuCount: 32,
      memoryTotalBytes: 68_719_476_736,
      channel: 'stable',
      runnerVersion: '0.14.2',
    });
    expect(inventory.bootedAt).toEqual(new Date('2026-09-20T08:14:03Z'));
    expect(inventory.facts).not.toHaveProperty('diskFreeBytes');
  });

  it('reads what an older runner did not send as unknown', () => {
    const old = { ...facts, osName: undefined, cpus: undefined, bootedAt: undefined };
    expect(inventoryFromFacts(old, null)).toMatchObject({
      osName: null,
      cpuCount: null,
      bootedAt: null,
    });
  });
});

describe('inventoryChanges', () => {
  const before = inventoryFromFacts(facts, 'stable');

  it('says nothing on first sight: pairing already described the machine', () => {
    expect(inventoryChanges(null, before)).toEqual([]);
  });

  it('gives a runner update its own entry', () => {
    const after = inventoryFromFacts({ ...facts, runnerVersion: '0.15.0' }, 'stable');
    expect(inventoryChanges(before, after)).toEqual([
      { kind: 'runner_updated', payload: { from: '0.14.2', to: '0.15.0' } },
    ]);
  });

  it('diffs everything else into one facts_changed entry', () => {
    const after = inventoryFromFacts(
      {
        ...facts,
        memoryTotalBytes: 137_438_953_472,
        bootedAt: '2026-09-26T09:00:00Z',
        tools: [...facts.tools, { name: 'claude', path: '/usr/bin/claude', required: false }],
      },
      'stable',
    );
    const [entry] = inventoryChanges(before, after);
    expect(entry.kind).toBe('facts_changed');
    expect(entry.payload.changed).toMatchObject({
      memoryTotalBytes: [68_719_476_736, 137_438_953_472],
      bootedAt: ['2026-09-20T08:14:03.000Z', '2026-09-26T09:00:00.000Z'],
      tools: [{ git: '2.45.0' }, { git: '2.45.0', claude: '' }],
    });
  });

  it('reads a field it did not know before as learned, not changed', () => {
    const backfilled = { ...before, osName: null, cpuCount: null, channel: null };
    expect(inventoryChanges(backfilled, before)).toEqual([]);
  });

  it('never reads a hello without a channel as the channel going away', () => {
    expect(inventoryChanges(before, inventoryFromFacts(facts, null))).toEqual([]);
  });
});
