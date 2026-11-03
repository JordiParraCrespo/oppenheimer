import { afterEach, describe, expect, it, vi } from 'vitest';
import { openLiveTranscription, pcm16Base64 } from './live-transcription';

/**
 * Live dictation's socket against a WebSocket double: it opens with the
 * ticket's secret as OpenAI's browser subprotocol, keeps audio pushed before
 * the handshake and sends it after, hands the words heard so far to `onText`
 * as they land, and on finish commits the audio and answers the last words.
 */

class FakeSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static last: FakeSocket | null = null;
  readyState = FakeSocket.CONNECTING;
  sent: { type: string; audio?: string }[] = [];

  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {
    super();
    FakeSocket.last = this;
  }

  send(frame: string) {
    this.sent.push(JSON.parse(frame));
  }

  close() {
    this.readyState = FakeSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  hear(event: object) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(event) }));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeSocket.last = null;
});

function open(onText = vi.fn()) {
  vi.stubGlobal('WebSocket', FakeSocket);
  const live = openLiveTranscription({ url: 'wss://live.test', secret: 'ek_1' }, onText);
  return { live, socket: FakeSocket.last as FakeSocket, onText };
}

describe('openLiveTranscription', () => {
  it("opens with the ticket's secret and sends the audio pushed during the handshake once it is open", () => {
    const { live, socket } = open();
    expect(socket.url).toBe('wss://live.test');
    expect(socket.protocols).toEqual(['realtime', 'openai-insecure-api-key.ek_1']);

    live.push(new Float32Array(480), 24_000);
    expect(socket.sent).toEqual([]);
    socket.open();

    expect(socket.sent).toEqual([
      { type: 'input_audio_buffer.append', audio: pcm16Base64(new Float32Array(480)) },
    ]);
  });

  it('hands everything heard so far to onText as each word lands', () => {
    const { socket, onText } = open();
    socket.open();
    const delta = 'conversation.item.input_audio_transcription.delta';
    socket.hear({ type: delta, item_id: 'a', delta: 'fix the' });
    socket.hear({ type: delta, item_id: 'a', delta: ' login' });

    expect(onText).toHaveBeenLastCalledWith('fix the login');
  });

  it('commits the audio on finish and answers the completed transcript', async () => {
    const { live, socket } = open();
    socket.open();
    const finished = live.finish();
    expect(socket.sent.at(-1)).toEqual({ type: 'input_audio_buffer.commit' });
    socket.hear({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'a',
      transcript: 'fix the login redirect.',
    });

    await expect(finished).resolves.toBe('fix the login redirect.');
    expect(socket.readyState).toBe(FakeSocket.CLOSED);
  });

  it('answers null when the socket failed before hearing anything', async () => {
    const { live, socket } = open();
    socket.dispatchEvent(new Event('error'));
    await expect(live.finish()).resolves.toBeNull();
  });
});

describe('pcm16Base64', () => {
  it('writes each sample as little-endian 16-bit PCM, clipped to full scale', () => {
    const bytes = Uint8Array.from(atob(pcm16Base64(Float32Array.of(1, -1, 2))), (c) =>
      c.charCodeAt(0),
    );
    const view = new DataView(bytes.buffer);
    expect([view.getInt16(0, true), view.getInt16(2, true), view.getInt16(4, true)]).toEqual([
      0x7fff, -0x8000, 0x7fff,
    ]);
  });
});
