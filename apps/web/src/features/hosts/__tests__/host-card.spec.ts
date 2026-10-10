import { HostEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { cardStatusOf, metaPartsOf } from '../lib/host-card';

function host(
  details: Partial<HostEntity['details']> = {},
  runnerVersion: string | null = '0.14.2',
) {
  return new HostEntity(
    'h-1',
    'optimus',
    true,
    'optimus',
    'ubuntu 24.04',
    'amd64',
    runnerVersion,
    new Date(),
    new Date(),
    {
      status: 'idle',
      runningSessionCount: 0,
      maxSessions: null,
      sessionLimit: null,
      osName: null,
      cpuCount: null,
      memoryTotalBytes: null,
      cloudProvider: null,
      countryCode: null,
      city: null,
      asnOrg: null,
      roundTripMillis: null,
      ...details,
    },
  );
}

describe('cardStatusOf', () => {
  it('passes running and idle through and draws everything else as offline', () => {
    expect(cardStatusOf(host({ status: 'running' }))).toBe('running');
    expect(cardStatusOf(host({ status: 'idle' }))).toBe('idle');
    expect(cardStatusOf(host({ status: 'offline' }))).toBe('offline');
    expect(cardStatusOf(host({ status: 'unpaired' }))).toBe('offline');
  });
});

describe('metaPartsOf', () => {
  it('reads the frame’s order: OS, vCPUs, where it connects from, runner', () => {
    expect(
      metaPartsOf(
        host({
          osName: 'Ubuntu 24.04.1 LTS',
          cpuCount: 32,
          memoryTotalBytes: 64 * 1024 ** 3,
          city: 'Madrid',
          countryCode: 'ES',
        }),
      ),
    ).toEqual([
      { kind: 'text', value: 'Ubuntu 24.04.1 LTS' },
      { kind: 'cpus', count: 32 },
      { kind: 'text', value: 'Madrid, ES' },
      { kind: 'runner', version: '0.14.2' },
    ]);
  });

  it('places a host by country alone when the city is unknown', () => {
    expect(metaPartsOf(host({ countryCode: 'ES' }, null))).toEqual([
      { kind: 'text', value: 'ubuntu 24.04' },
      { kind: 'text', value: 'ES' },
    ]);
  });

  it('shows only what is known, falling back to the platform for the OS', () => {
    expect(metaPartsOf(host({}, null))).toEqual([{ kind: 'text', value: 'ubuntu 24.04' }]);
  });
});
