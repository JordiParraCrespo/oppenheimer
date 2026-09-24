import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import {
  LINK_MAX_BUFFERED_BYTES,
  SocketRunnerLink,
} from '../infrastructure/socket-runner-link.adapter';

function fakeSocket(bufferedAmount: number) {
  return {
    OPEN: 1,
    CONNECTING: 0,
    readyState: 1,
    bufferedAmount,
    send: vi.fn(),
    close: vi.fn(),
  };
}

/**
 * A runner that stopped reading is closed, never skipped: a frame dropped
 * silently could be a credit, and a lost credit stalls its pane for good.
 */
describe('SocketRunnerLink', () => {
  it('writes while the runner keeps up', () => {
    const socket = fakeSocket(0);
    const link = new SocketRunnerLink('host', 'run', 1, socket as unknown as WebSocket);
    expect(link.sendBinary(3, new Uint8Array([1]))).toBe(true);
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(socket.close).not.toHaveBeenCalled();
  });

  it('closes a runner past the buffer bound instead of dropping the frame', () => {
    const socket = fakeSocket(LINK_MAX_BUFFERED_BYTES);
    const link = new SocketRunnerLink('host', 'run', 1, socket as unknown as WebSocket);
    expect(link.send({ type: 'attachment.credit', attachmentId: 3, bytes: 10 } as never)).toBe(
      false,
    );
    expect(socket.send).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalledWith(1013, 'slow consumer');
  });
});
