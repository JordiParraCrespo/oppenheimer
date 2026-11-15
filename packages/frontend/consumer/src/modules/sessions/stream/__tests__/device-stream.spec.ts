import { ATTACH_CLOSE_CODES } from '@oppenheimer/shared/protocol';
import { beforeEach, expect, it, vi } from 'vitest';
import { AttachDeviceStream, type DeviceInfo, type DeviceStatus } from '../device-stream';

/**
 * The Simulator's device picker and Refresh against a scripted socket: a pick
 * goes out on the open socket, and Refresh dials once more from any status,
 * the final "no device" included, without leaving a second socket open.
 */

class FakeSocket {
  static OPEN = 1;
  readonly sent: string[] = [];
  readyState = FakeSocket.OPEN;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  closed = false;

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
  }

  text(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const settle = async () => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

function harness(issueTicket?: () => Promise<{ ticket: string; url: string }>) {
  const sockets: FakeSocket[] = [];
  const stream = new AttachDeviceStream({
    issueTicket: issueTicket ?? (async () => ({ ticket: 't', url: '/api/v1/relay/attach' })),
    apiBaseUrl: 'https://api.example.com',
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    schedule: () => () => {},
  });
  const statuses: DeviceStatus[] = [];
  const devices: DeviceInfo[] = [];
  stream.onStatus((status) => statuses.push(status));
  stream.onDevice((device) => devices.push(device));
  return { stream, sockets, statuses, devices };
}

const phone = { serial: 'UDID-1', name: 'iPhone 17 Pro', platform: 'ios', free: true } as const;
const tablet = { serial: 'UDID-2', name: 'iPad Air', platform: 'ios', free: true } as const;

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket);
});

it('lists the host’s devices and sends a pick on the open socket', async () => {
  const { stream, sockets, devices } = harness();
  await settle();
  sockets[0]?.text({ type: 'device', ...phone, devices: [phone, tablet] });
  expect(devices.at(-1)?.devices).toEqual([phone, tablet]);

  stream.select(tablet.serial);
  expect(sockets[0]?.sent.map((m) => JSON.parse(m))).toEqual([
    { type: 'device.select', serial: 'UDID-2' },
  ]);
});

it('refreshes after "no device", so a simulator booted since is picked up', async () => {
  const { stream, sockets, statuses } = harness();
  await settle();
  sockets[0]?.drop(ATTACH_CLOSE_CODES.REFUSED);
  expect(statuses.at(-1)).toBe('unavailable');

  stream.refresh();
  await settle();
  expect(statuses.at(-1)).toBe('connecting');
  sockets[1]?.text({ type: 'device', ...tablet });
  expect(statuses.at(-1)).toBe('live');
});

it('closes the old socket on refresh and keeps one open when a refresh overtakes a dial', async () => {
  const gate: { release?: () => void } = {};
  let calls = 0;
  const { stream, sockets } = harness(async () => {
    calls += 1;
    // The first dial's ticket is slow; the refresh's comes at once.
    if (calls === 1)
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });
    return { ticket: `t-${calls}`, url: '/api/v1/relay/attach' };
  });
  stream.refresh();
  await settle();
  gate.release?.();
  await settle();
  expect(sockets).toHaveLength(1);

  stream.refresh();
  await settle();
  expect(sockets[0]?.closed).toBe(true);
  expect(sockets).toHaveLength(2);
  expect(sockets[1]?.closed).toBe(false);
});
