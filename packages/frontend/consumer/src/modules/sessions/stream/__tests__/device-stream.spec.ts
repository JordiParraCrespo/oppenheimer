import { ATTACH_CLOSE_CODES } from '@oppenheimer/shared/protocol';
import { beforeEach, expect, it, vi } from 'vitest';
import { CONSUMER_CONFIG } from '../../../../config';
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

/** A harness whose timers run when the test says, for held input's expiry. */
function timedHarness() {
  const sockets: FakeSocket[] = [];
  const timers: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const stream = new AttachDeviceStream({
    issueTicket: async () => ({ ticket: 't', url: '/api/v1/relay/attach' }),
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    schedule: (run, ms) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  });
  const sentInput = (socket: FakeSocket | undefined) =>
    (socket?.sent ?? []).map((m) => JSON.parse(m)).filter((m) => m.type === 'device.input');
  const elapse = (ms: number) => {
    for (const timer of timers.splice(0)) {
      if (timer.cancelled) continue;
      if (timer.ms <= ms) timer.run();
      else timers.push(timer);
    }
  };
  return { stream, sockets, sentInput, elapse };
}

const tap = (x: number) => ({ kind: 'tap', x, y: 0.5 }) as const;

it('holds a tap made while the socket redials and sends it once the device is live again', async () => {
  const { stream, sockets, sentInput } = timedHarness();
  await settle();
  sockets[0]?.text({ type: 'device', ...phone });
  sockets[0]?.drop(ATTACH_CLOSE_CODES.LINK_LOST);

  stream.input(tap(0.1));
  stream.input({
    kind: 'swipe',
    x: 0.5,
    y: 0.8,
    toX: 0.5,
    toY: 0.2,
    durationMs: 90,
    momentum: true,
  });
  expect(sentInput(sockets[0])).toEqual([]);

  // The redial is the retry the stream scheduled; run it.
  stream.refresh();
  await settle();
  // Open, but the runner has not attached yet: still held.
  expect(sentInput(sockets[1])).toEqual([]);
  sockets[1]?.text({ type: 'device', ...phone });
  expect(sentInput(sockets[1])).toEqual([
    { type: 'device.input', ...tap(0.1) },
    {
      type: 'device.input',
      kind: 'swipe',
      x: 0.5,
      y: 0.8,
      toX: 0.5,
      toY: 0.2,
      durationMs: 90,
      momentum: true,
    },
  ]);
});

it('drops held input older than its window instead of replaying it late', async () => {
  const { stream, sockets, sentInput, elapse } = timedHarness();
  await settle();
  stream.input(tap(0.1));
  elapse(CONSUMER_CONFIG.device.heldInputMs);
  stream.input(tap(0.2));
  sockets[0]?.text({ type: 'device', ...phone });
  expect(sentInput(sockets[0])).toEqual([{ type: 'device.input', ...tap(0.2) }]);
});

it('holds a bounded number of inputs, keeping the newest', async () => {
  const { stream, sockets, sentInput } = timedHarness();
  await settle();
  for (let i = 0; i < 40; i += 1) stream.input(tap(i / 40));
  sockets[0]?.text({ type: 'device', ...phone });
  const sent = sentInput(sockets[0]);
  expect(sent).toHaveLength(16);
  expect(sent.at(-1)).toEqual({ type: 'device.input', ...tap(39 / 40) });
});

it('holds nothing for a session whose device is gone for good', async () => {
  const { stream, sockets, sentInput } = timedHarness();
  await settle();
  sockets[0]?.drop(ATTACH_CLOSE_CODES.SESSION_STOPPED);
  stream.input(tap(0.3));
  stream.refresh();
  await settle();
  sockets[1]?.text({ type: 'device', ...phone });
  expect(sentInput(sockets[1])).toEqual([]);
});
