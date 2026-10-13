import { describe, expect, it } from 'vitest';
import { connectionRows } from './connection-rows';

/**
 * The Connection list's stage rules: a row turns done only on what the API
 * reports, and only the first row not done reads as in progress. A regression
 * would show Host connected green for a runner that registered and never
 * dialled in, or pulse two rows at once.
 */
describe('connectionRows', () => {
  const machine = { name: 'mac-studio', os: 'macos', runnerVersion: '0.9.2' };

  it('waits on the install before any host exists', () => {
    expect(connectionRows(null)).toEqual([
      { key: 'installed', label: 'installWaiting', state: 'current', detail: null },
      { key: 'connected', label: 'connected', state: 'next', detail: null },
    ]);
  });

  it('marks the runner installed when the host registers, and waits on it dialling in', () => {
    expect(connectionRows({ ...machine, online: false })).toEqual([
      { key: 'installed', label: 'installed', state: 'done', detail: 'v0.9.2' },
      { key: 'connected', label: 'connected', state: 'current', detail: null },
    ]);
  });

  it('marks the host connected once it is online, with its name and OS', () => {
    expect(connectionRows({ ...machine, online: true, runnerVersion: 'v0.9.2' })).toEqual([
      { key: 'installed', label: 'installed', state: 'done', detail: 'v0.9.2' },
      { key: 'connected', label: 'connected', state: 'done', detail: 'mac-studio · macos' },
    ]);
  });
});
