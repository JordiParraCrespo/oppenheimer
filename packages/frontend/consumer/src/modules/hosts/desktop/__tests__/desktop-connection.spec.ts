import { ATTACH_CLOSE_CODES } from '@oppenheimer/shared/protocol';
import { describe, expect, it, vi } from 'vitest';
import { AttachDesktopConnection, type DesktopState } from '../desktop-connection';

/**
 * The channel a VNC viewer attaches to, against a scripted desktop socket:
 * it opens only once the host has signed in (so the viewer's handshake starts
 * at the server's first byte), the relay's own frames never reach the viewer
 * as bytes, a refusal is final and a lost host is not, and control is asked
 * of the host rather than assumed.
 */

class FakeSocket {
  readonly sent: (string | BufferSource)[] = [];
  readyState = 0;
  binaryType = 'blob';
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {}
  send(data: string | BufferSource) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = WebSocket.OPEN;
  }
  text(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  bytes(text: string) {
    this.onmessage?.({ data: new TextEncoder().encode(text).buffer });
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code, reason: '', wasClean: false });
  }
}

async function connect() {
  const sockets: FakeSocket[] = [];
  const connection = new AttachDesktopConnection({
    issueTicket: vi.fn().mockResolvedValue({ ticket: 'tk', url: '/api/v1/relay/desktop' }),
    apiBaseUrl: 'https://api.example.com',
    socketFactory: (url, protocols) => {
      const socket = new FakeSocket(url, protocols);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
  });
  await vi.waitFor(() => expect(sockets).toHaveLength(1));
  const socket = sockets[0] as FakeSocket;
  socket.open();
  const states: DesktopState[] = [];
  connection.onState((state) => states.push(state));
  const received: string[] = [];
  const opened = vi.fn();
  const closed = vi.fn();
  connection.onopen = opened;
  connection.onmessage = (event) => received.push(new TextDecoder().decode(event.data));
  connection.onclose = closed;
  return { connection, socket, states, received, opened, closed };
}

describe('AttachDesktopConnection', () => {
  it('dials the desktop socket with the ticket as its subprotocol', async () => {
    const { socket } = await connect();
    expect(socket.url).toBe('wss://api.example.com/api/v1/relay/desktop');
    expect(socket.protocols).toEqual(['tk']);
  });

  it('opens for the viewer only once the host signed in, handing over what came before', async () => {
    const { connection, socket, states, received, opened } = await connect();
    socket.bytes('RFB 003.008\n');
    expect(connection.readyState).toBe('connecting');
    expect(received).toEqual([]);

    socket.text({ type: 'desktop', control: false });
    expect(opened).toHaveBeenCalledOnce();
    expect(connection.readyState).toBe('open');
    expect(received).toEqual(['RFB 003.008\n']);
    expect(states.at(-1)).toEqual({ status: 'live', control: false, refusal: null });
  });

  it('asks the host for control and reports it only once the host says so', async () => {
    const { connection, socket, states } = await connect();
    socket.text({ type: 'desktop', control: false });
    connection.setControl(true);
    expect(socket.sent).toContain(JSON.stringify({ type: 'desktop.control', control: true }));
    expect(states.at(-1)?.control).toBe(false);

    socket.text({ type: 'desktop', control: true });
    expect(states.at(-1)?.control).toBe(true);
  });

  it('keeps a refusal and ends there: a host that does not share its desktop is not redialled', async () => {
    const { socket, states, closed, received } = await connect();
    socket.text({ type: 'refused', code: 'DESKTOP_001', detail: 'runner desktop on' });
    socket.drop(ATTACH_CLOSE_CODES.REFUSED);
    expect(states.at(-1)).toMatchObject({
      status: 'unavailable',
      refusal: { code: 'DESKTOP_001', detail: 'runner desktop on' },
    });
    expect(closed).toHaveBeenCalledOnce();
    expect(received).toEqual([]);
  });

  it('says the host is offline when its link is lost, which is worth dialling again', async () => {
    const { socket, states } = await connect();
    socket.text({ type: 'desktop', control: false });
    socket.text({ type: 'hint', kind: 'host_offline' });
    socket.drop(ATTACH_CLOSE_CODES.LINK_LOST);
    expect(states.at(-1)?.status).toBe('offline');
  });
});
